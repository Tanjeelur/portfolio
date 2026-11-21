"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * GEO Intelligence fan-out pipeline, told as a looping scenario:
 *   Normal traffic → Traffic spike → 429 storm on one engine → Recovery
 * Requests are comet packets: queue → token bucket (25 tokens/s = 1,500 RPM) → concurrency gate → 6 LLM engines.
 * Failed calls retry with exponential backoff (they can't be re-routed: each engine must be measured itself).
 * Static structure is SVG; the many moving packets are drawn on a canvas overlay in the same coordinates.
 * "Take control" swaps the script for a load slider, a spike button and an engine-failure toggle.
 */

const REFILL = 25;
const CAPACITY = 25;
const SLOTS = 24; // demo-scale stand-in for the 200-call gate
const QUEUE_CAP = 200;
const CYCLE = 26;
const BROKEN = 2; // Claude
const ENGINES = [
  { name: "ChatGPT", color: "#5eead4", lat: 0.32 },
  { name: "Gemini", color: "#60a5fa", lat: 0.25 },
  { name: "Claude", color: "#fb923c", lat: 0.35 },
  { name: "Perplexity", color: "#a78bfa", lat: 0.42 },
  { name: "AI Overviews", color: "#f472b6", lat: 0.28 },
  { name: "AI Mode", color: "#fbbf24", lat: 0.38 },
];
const PHASES = [
  { name: "Normal traffic", until: 6, load: 14 },
  { name: "Traffic spike", until: 12, load: 36 },
  { name: "429 storm", until: 19, load: 18 },
  { name: "Recovery", until: 26, load: 10 },
];

type P = { x: number; y: number };
type Req = {
  x: number;
  y: number;
  trail: P[];
  state: "queued" | "flying" | "busy" | "done" | "back" | "backoff" | "shed";
  engine: number;
  from: P;
  ctrl: P;
  to: P;
  t0: number;
  dur: number;
  until: number;
  retries: number;
  alpha: number;
  orbit: number;
};
type Drop = { x: number; y0: number; y1: number; t0: number };
type Log = { id: number; t: number; tag: string; color: string; text: string; tone?: "ok" | "bad" | "warn" };

function geometry(vertical: boolean) {
  if (!vertical) {
    const W = 720;
    const H = 360;
    return {
      W,
      H,
      src: { x: 34, y: 180 },
      queue: (i: number) => ({ x: 196 - (i % 10) * 13, y: 180 + (Math.floor(Math.min(i, 69) / 10) - 3) * 13 }),
      bucket: { x: 226, y: 95, w: 40, h: 170 },
      slot: (i: number) => ({ x: 300, y: 95 + i * (170 / SLOTS), w: 14, h: 170 / SLOTS - 2.5 }),
      engine: (i: number) => ({ x: 520, y: 45 + i * 54 }),
      label: (i: number) => ({ x: 548, y: 45 + i * 54, anchor: "start" as const }),
      exit: (e: P) => ({ x: W + 20, y: e.y }),
    };
  }
  const W = 360;
  const H = 600;
  const cols = [70, 180, 290];
  return {
    W,
    H,
    src: { x: 180, y: 26 },
    queue: (i: number) => ({ x: 180 + ((i % 12) - 5.5) * 14, y: 66 + Math.floor(Math.min(i, 71) / 12) * 12 }),
    bucket: { x: 150, y: 150, w: 60, h: 105 },
    slot: (i: number) => ({ x: 37 + i * 12, y: 282, w: 9, h: 20 }),
    engine: (i: number) => ({ x: cols[i % 3], y: 382 + Math.floor(i / 3) * 112 }),
    label: (i: number) => ({ x: cols[i % 3], y: 382 + Math.floor(i / 3) * 112 + 36, anchor: "middle" as const }),
    exit: (e: P) => ({ x: e.x, y: H + 20 }),
  };
}

const bez = (a: P, c: P, b: P, t: number): P => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const fmt = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(1).padStart(4, "0")}`;

type Stats = { tokens: number; inflight: number; queued: number; retried: number; tps: number; busy: number[]; t: number; phase: number };

export default function RateLimiterDemo() {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [vertical, setVertical] = useState(false);
  const verticalRef = useRef(false);
  const [manual, setManual] = useState(false);
  const manualRef = useRef(false);
  const [load, setLoad] = useState(18);
  const loadRef = useRef(18);
  const [broken, setBroken] = useState(false);
  const brokenRef = useRef(false);
  const burstRef = useRef(0);
  const resetRef = useRef(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<Stats>({ tokens: CAPACITY, inflight: 0, queued: 0, retried: 0, tps: 0, busy: ENGINES.map(() => 0), t: 0, phase: 0 });

  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    brokenRef.current = broken;
  }, [broken]);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      manualRef.current = true;
      setManual(true);
    }

    let G = geometry(verticalRef.current);
    let scale = 1;
    const resize = () => {
      const w = stage.current!.clientWidth;
      const v = w < 560;
      if (v !== verticalRef.current) {
        verticalRef.current = v;
        setVertical(v);
      }
      G = geometry(v);
      scale = w / G.W;
      const h = G.H * scale;
      const dpr = Math.min(window.devicePixelRatio, 2);
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.height = `${h}px`;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage.current!);

    // ---- simulation state ----
    let t = 0;
    let reqs: Req[] = [];
    let queue: Req[] = [];
    let drops: Drop[] = [];
    let tokens = CAPACITY;
    let lastTokenInt = CAPACITY;
    let spawnAcc = 0;
    let inflight = 0;
    let retried = 0;
    let doneTimes: number[] = [];
    let phase = -1;
    let statAcc = 0;
    let logId = 0;
    const lastLog: Record<string, number> = {};
    let pendingLogs: Log[] = [];
    let peakQueue = 0;
    let shedTotal = 0;
    let wasDrained = true;

    const log = (key: string, every: number, tag: string, color: string, text: string, tone?: Log["tone"]) => {
      if (lastLog[key] !== undefined && t - lastLog[key] < every) return;
      lastLog[key] = t;
      pendingLogs.push({ id: ++logId, t, tag, color, text, tone });
    };

    const reset = () => {
      t = 0;
      reqs = [];
      queue = [];
      drops = [];
      tokens = CAPACITY;
      lastTokenInt = CAPACITY;
      inflight = 0;
      retried = 0;
      doneTimes = [];
      phase = -1;
      peakQueue = 0;
      shedTotal = 0;
      for (const k of Object.keys(lastLog)) delete lastLog[k];
      setLogs([]);
    };

    const enqueue = (r: Req) => {
      if (queue.length >= QUEUE_CAP) {
        r.state = "shed";
        r.to = { x: r.x, y: G.H + 30 };
        shedTotal++;
        log("shed", 1.5, "gate", "#f87171", `queue full → shed ${shedTotal} request${shedTotal > 1 ? "s" : ""}`, "bad");
        return;
      }
      r.state = "queued";
      queue.push(r);
    };
    const spawn = () => {
      const r: Req = {
        x: G.src.x,
        y: G.src.y,
        trail: [],
        state: "queued",
        engine: 0,
        from: G.src,
        ctrl: G.src,
        to: G.src,
        t0: 0,
        dur: 0,
        until: 0,
        retries: 0,
        alpha: 1,
        orbit: Math.random() * Math.PI * 2,
      };
      reqs.push(r);
      enqueue(r);
    };

    const step = (dt: number) => {
      t += dt;
      const auto = !manualRef.current;
      const ct = t % CYCLE;
      if (auto && t >= CYCLE * 50) reset();

      // --- scenario ---
      let curLoad = loadRef.current;
      let brokenNow = brokenRef.current;
      if (auto) {
        const p = PHASES.findIndex((ph) => ct < ph.until);
        if (p !== phase) {
          phase = p;
          if (p === 0) {
            log(`ph${t}`, 0, "load", "#e8eaf2", "normal traffic · 14 req/s");
            peakQueue = 0;
          }
          if (p === 1) {
            burstRef.current += 30;
            log(`ph${t}`, 0, "load", "#fbbf24", "traffic spike · +30 burst, then 36 req/s (limit 25)", "warn");
          }
          if (p === 2) log(`ph${t}`, 0, "Claude", ENGINES[BROKEN].color, "starts returning 429 Too Many Requests", "bad");
          if (p === 3) log(`ph${t}`, 0, "Claude", ENGINES[BROKEN].color, "healthy again · draining retries", "ok");
        }
        curLoad = PHASES[phase].load;
        brokenNow = phase === 2;
      }

      // --- arrivals ---
      spawnAcc += curLoad * dt * (0.6 + Math.random() * 0.8);
      while (spawnAcc >= 1) {
        spawn();
        spawnAcc -= 1;
      }
      while (burstRef.current > 0) {
        spawn();
        burstRef.current--;
      }

      // --- token bucket refill (+ cosmetic drops) ---
      tokens = Math.min(CAPACITY, tokens + REFILL * dt);
      const ti = Math.floor(tokens);
      if (ti > lastTokenInt && drops.length < 30) {
        const b = G.bucket;
        const level = b.y + b.h - (tokens / CAPACITY) * b.h;
        drops.push({ x: b.x + b.w * (0.3 + Math.random() * 0.4), y0: b.y - 18, y1: level, t0: t });
      }
      lastTokenInt = ti;

      // --- dispatch through the gate ---
      let held = false;
      while (queue.length && inflight < SLOTS) {
        if (tokens < 1) {
          held = true;
          break;
        }
        const r = queue.shift()!;
        tokens -= 1;
        inflight++;
        const busy = ENGINES.map(() => 0);
        for (const q of reqs) if (q.state === "flying" || q.state === "busy") busy[q.engine]++;
        r.engine = busy.indexOf(Math.min(...busy));
        const slot = G.slot(inflight - 1);
        r.state = "flying";
        r.from = { x: r.x, y: r.y };
        r.ctrl = { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2 };
        r.to = G.engine(r.engine);
        r.t0 = t;
        r.dur = 0.35;
      }
      if (queue.length > 10 && (held || inflight >= SLOTS))
        log("hold", 2.2, "bucket", "#5eead4", held ? `empty → holding ${queue.length} requests (no 429s sent upstream)` : `gate full ${SLOTS}/${SLOTS} → ${queue.length} waiting`, "warn");
      peakQueue = Math.max(peakQueue, queue.length);
      if (queue.length === 0 && !wasDrained && peakQueue > 10) {
        log("drained", 3, "queue", "#4ade80", `drained · peak ${peakQueue} · ${shedTotal} dropped`, "ok");
        peakQueue = 0;
      }
      wasDrained = queue.length === 0;

      // --- motion + lifecycle ---
      queue.forEach((r, i) => {
        const s = G.queue(i);
        r.to = s;
      });
      for (let i = reqs.length - 1; i >= 0; i--) {
        const r = reqs[i];
        if (r.state === "queued" || r.state === "shed" || r.state === "backoff") {
          const k = 1 - Math.exp(-9 * dt);
          r.x += (r.to.x - r.x) * k;
          r.y += (r.to.y - r.y) * k;
          if (r.state === "backoff" && t >= r.until) enqueue(r);
        } else if (r.state === "flying" || r.state === "done" || r.state === "back") {
          const p = Math.min(1, (t - r.t0) / r.dur);
          const q = bez(r.from, r.ctrl, r.to, ease(p));
          r.x = q.x;
          r.y = q.y;
          if (p >= 1) {
            if (r.state === "flying") {
              r.state = "busy";
              r.until = t + ENGINES[r.engine].lat * (0.6 + Math.random() * 0.8);
            } else if (r.state === "back") {
              r.state = "backoff";
              r.to = { x: r.x, y: r.y };
            } else r.alpha = 0;
          }
        } else if (r.state === "busy") {
          const e = G.engine(r.engine);
          r.orbit += dt * 5;
          r.x = e.x + Math.cos(r.orbit) * 25;
          r.y = e.y + Math.sin(r.orbit) * 25;
          if (t >= r.until) {
            inflight--;
            const rateLimited = brokenNow && r.engine === BROKEN;
            const failRate = rateLimited ? 0.7 : 0.01; // healthy engines still time out occasionally
            r.from = { x: r.x, y: r.y };
            r.t0 = t;
            if (Math.random() < failRate) {
              r.retries++;
              retried++;
              const wait = Math.min(1.6, 0.2 * Math.pow(2, r.retries));
              r.state = "back";
              r.to = G.queue(Math.min(queue.length + 4, 60));
              r.ctrl = { x: (r.from.x + r.to.x) / 2, y: Math.min(r.from.y, r.to.y) - 60 };
              r.dur = 0.6;
              r.until = t + 0.6 + wait;
              log(`retry${r.engine}`, 0.8, ENGINES[r.engine].name, ENGINES[r.engine].color, `${rateLimited ? "429" : "timeout"} → retry #${r.retries} in ${Math.round(wait * 1000)}ms (backoff)`, "bad");
            } else {
              r.state = "done";
              r.to = G.exit(r.from);
              r.ctrl = verticalRef.current ? { x: r.from.x, y: r.from.y + 40 } : { x: r.from.x + 60, y: r.from.y };
              r.dur = 0.5;
              doneTimes.push(t);
            }
          }
        }
        if (r.state === "shed") {
          r.alpha -= dt * 1.5;
          const k = 1 - Math.exp(-4 * dt);
          r.y += (r.to.y - r.y) * k;
        }
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 7) r.trail.shift();
        if (r.alpha <= 0) reqs.splice(i, 1);
      }
      while (doneTimes.length && doneTimes[0] < t - 1) doneTimes.shift();
      drops = drops.filter((d) => t - d.t0 < 0.35);

      // --- publish to React at ~10 Hz ---
      statAcc += dt;
      if (statAcc > 0.1) {
        statAcc = 0;
        const busy = ENGINES.map(() => 0);
        for (const q of reqs) if (q.state === "busy" || q.state === "flying") busy[q.engine]++;
        setStats({ tokens, inflight, queued: queue.length, retried, tps: doneTimes.length, busy, t: ct, phase: Math.max(0, phase) });
        if (pendingLogs.length) {
          const add = pendingLogs;
          pendingLogs = [];
          setLogs((l) => [...l, ...add].slice(-8));
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, G.W, G.H);
      // token drops
      for (const d of drops) {
        const p = Math.min(1, (t - d.t0) / 0.35);
        ctx.fillStyle = `rgba(94,234,212,${1 - p * 0.5})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y0 + (d.y1 - d.y0) * p * p, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // packets with comet trails
      for (const r of reqs) {
        let c = "#9aa3c7";
        if (r.state === "flying" || r.state === "busy") c = ENGINES[r.engine].color;
        if (r.state === "done") c = "#4ade80";
        if (r.state === "back" || r.state === "backoff" || (r.state === "queued" && r.retries)) c = "#fbbf24";
        if (r.state === "shed") c = "#ef4444";
        const moving = r.state !== "queued" && r.state !== "backoff";
        ctx.globalAlpha = Math.max(0, r.alpha);
        if (moving && r.trail.length > 1) {
          for (let k = 1; k < r.trail.length; k++) {
            ctx.strokeStyle = c;
            ctx.globalAlpha = Math.max(0, r.alpha) * (k / r.trail.length) * 0.6;
            ctx.lineWidth = 2.2 * (k / r.trail.length);
            ctx.beginPath();
            ctx.moveTo(r.trail[k - 1].x, r.trail[k - 1].y);
            ctx.lineTo(r.trail[k].x, r.trail[k].y);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = Math.max(0, r.alpha) * (r.state === "queued" ? 0.85 : 1);
        ctx.shadowColor = c;
        ctx.shadowBlur = moving ? 10 : 0;
        ctx.fillStyle = moving ? "#fff" : c;
        ctx.beginPath();
        ctx.arc(r.x, r.y, moving ? 2.6 : 3, 0, Math.PI * 2);
        ctx.fill();
        if (moving) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(r.x, r.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (resetRef.current) {
        resetRef.current = false;
        reset();
      }
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(wrap.current!);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  const toggleManual = () => {
    const m = !manual;
    manualRef.current = m;
    setManual(m);
    setBroken(false);
    resetRef.current = true;
  };

  const G = geometry(vertical);
  const b = G.bucket;
  const level = Math.max(0, Math.min(1, stats.tokens / CAPACITY));
  const brokenNow = manual ? broken : stats.phase === 2;
  const progress = stats.t / CYCLE;

  return (
    <div ref={wrap}>
      {/* Scenario tracker / manual controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnimatePresence mode="wait" initial={false}>
          {!manual ? (
            <motion.div key="auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative min-w-[260px] flex-1">
              <div className="absolute left-0 right-0 top-[13px] h-px bg-line" />
              <div className="absolute left-0 top-[13px] h-px bg-gradient-to-r from-cyan via-amber to-red-400" style={{ width: `${progress * 100}%` }} />
              <ol className="relative flex justify-between">
                {PHASES.map((ph, i) => {
                  const on = stats.phase === i;
                  const past = stats.phase > i;
                  return (
                    <li key={ph.name} className="flex flex-col items-center gap-1.5">
                      <motion.span
                        animate={{ scale: on ? 1.15 : 1, backgroundColor: on || past ? (i === 2 ? "#f87171" : "#5eead4") : "#0d1018", color: on || past ? "#05060a" : "#8b90a5" }}
                        className="grid h-7 w-7 place-items-center rounded-full border border-line font-mono text-[11px] font-bold"
                      >
                        {past ? "✓" : i + 1}
                      </motion.span>
                      {/* narrow screens: only the active phase is labelled */}
                      <span
                        className={`whitespace-nowrap font-mono text-[10px] uppercase tracking-widest ${on ? "text-fg" : "hidden text-muted sm:inline"} ${
                          i === 0 ? "self-start sm:self-auto" : i === PHASES.length - 1 ? "self-end sm:self-auto" : ""
                        }`}
                      >
                        {ph.name}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </motion.div>
          ) : (
            <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-wrap items-end gap-x-5 gap-y-3">
              <label className="min-w-[200px] flex-1">
                <span className="flex justify-between font-mono text-[11px] uppercase tracking-widest text-muted">
                  <span>incoming load</span>
                  <span className={load > REFILL ? "text-amber" : "text-cyan"}>
                    {load} req/s · {(load * 60).toLocaleString()} RPM
                  </span>
                </span>
                <input
                  type="range"
                  min={4}
                  max={60}
                  value={load}
                  onChange={(e) => setLoad(Number(e.target.value))}
                  className="mt-2 w-full accent-[var(--cyan)]"
                  aria-label="Incoming request load"
                />
              </label>
              <button onClick={() => (burstRef.current += 45)} className="rounded-full border border-line px-3.5 py-1.5 text-sm hover:border-amber hover:text-amber">
                ⚡ Spike
              </button>
              <button
                onClick={() => setBroken((v) => !v)}
                aria-pressed={broken}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${broken ? "border-red-400 text-red-400" : "border-line hover:border-red-400 hover:text-red-400"}`}
              >
                {broken ? "✕ Claude failing" : "Break Claude"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={toggleManual} data-magnetic className="rounded-full bg-cyan px-4 py-1.5 text-sm font-semibold text-bg">
          {manual ? "▶ Play scenario" : "🎛 Take control"}
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* ---------- stage ---------- */}
        <div ref={stage} className="relative min-w-0 overflow-hidden rounded-2xl border border-line bg-[radial-gradient(circle_at_50%_40%,#10131d,#07080d)]">
          <svg viewBox={`0 0 ${G.W} ${G.H}`} className="block w-full" role="img" aria-label="Requests flowing through a token bucket and concurrency gate to six LLM engines">
            <defs>
              <pattern id="rl-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M24 0H0V24" fill="none" stroke="rgba(255,255,255,0.035)" />
              </pattern>
              <linearGradient id="rl-liquid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5eead4" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#5eead4" stopOpacity={0.25} />
              </linearGradient>
              {ENGINES.map((e, i) => (
                <radialGradient key={e.name} id={`rl-halo-${i}`}>
                  <stop offset="0%" stopColor={e.color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={e.color} stopOpacity={0} />
                </radialGradient>
              ))}
              <radialGradient id="rl-halo-err">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#rl-grid)" />

            {/* source */}
            <g transform={`translate(${G.src.x},${G.src.y})`}>
              <circle r={14} fill="#0b0e16" stroke="#e8eaf2" strokeOpacity={0.4} />
              <circle r={5} fill="#e8eaf2">
                <animate attributeName="r" values="3;6;3" dur="1s" repeatCount="indefinite" />
              </circle>
              <text y={vertical ? -20 : 28} textAnchor="middle" className="fill-muted font-mono text-[9px] uppercase tracking-widest">
                requests
              </text>
            </g>

            {/* token bucket: a glass vessel with liquid */}
            <g>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.25)" />
              <rect
                x={b.x + 3}
                y={b.y + 3 + (b.h - 6) * (1 - level)}
                width={b.w - 6}
                height={(b.h - 6) * level}
                rx={5}
                fill="url(#rl-liquid)"
                style={{ transition: "y .12s linear, height .12s linear", filter: "drop-shadow(0 0 8px rgba(94,234,212,.5))" }}
              />
              <text x={b.x + b.w / 2} y={b.y - 26} textAnchor="middle" className="fill-muted font-mono text-[9px] uppercase tracking-widest">
                token bucket
              </text>
              <text x={b.x + b.w / 2} y={b.y + b.h + 16} textAnchor="middle" className="font-mono text-[10px]" style={{ fill: level < 0.08 ? "#fbbf24" : "#e8eaf2" }}>
                {Math.floor(stats.tokens)}/{CAPACITY}
              </text>
              <text x={b.x + b.w / 2} y={b.y + b.h + 28} textAnchor="middle" className="fill-muted font-mono text-[8px]">
                +25/s · 1,500 RPM
              </text>
            </g>

            {/* concurrency gate */}
            <g>
              {Array.from({ length: SLOTS }, (_, i) => {
                const s = G.slot(i);
                const on = i < stats.inflight;
                return (
                  <rect
                    key={i}
                    x={s.x}
                    y={s.y}
                    width={s.w}
                    height={s.h}
                    rx={2}
                    fill={on ? "#a78bfa" : "rgba(255,255,255,0.06)"}
                    style={{ transition: "fill .15s", filter: on ? "drop-shadow(0 0 4px #a78bfa)" : undefined }}
                  />
                );
              })}
              {(() => {
                const s0 = G.slot(0);
                const sN = G.slot(SLOTS - 1);
                const cx = vertical ? (s0.x + sN.x + sN.w) / 2 : s0.x + s0.w / 2;
                return (
                  <>
                    <text x={cx} y={vertical ? s0.y - 10 : s0.y - 26} textAnchor="middle" className="fill-muted font-mono text-[9px] uppercase tracking-widest">
                      gate
                    </text>
                    <text x={cx} y={vertical ? s0.y + s0.h + 14 : sN.y + sN.h + 16} textAnchor="middle" className="fill-fg font-mono text-[10px]">
                      {stats.inflight}/{SLOTS}
                    </text>
                  </>
                );
              })()}
            </g>

            {/* engines */}
            {ENGINES.map((e, i) => {
              const p = G.engine(i);
              const l = G.label(i);
              const err = brokenNow && i === BROKEN;
              const busy = stats.busy[i] > 0;
              return (
                <g key={e.name}>
                  <circle cx={p.x} cy={p.y} r={30} fill={err ? "url(#rl-halo-err)" : `url(#rl-halo-${i})`} opacity={err ? 1 : busy ? 0.9 : 0.3} style={{ transition: "opacity .3s" }}>
                    {err && <animate attributeName="r" values="26;34;26" dur="0.6s" repeatCount="indefinite" />}
                  </circle>
                  <circle cx={p.x} cy={p.y} r={14} fill="#0b0e16" stroke={err ? "#ef4444" : e.color} strokeWidth={busy || err ? 2 : 1} strokeOpacity={busy || err ? 1 : 0.45} />
                  <text x={p.x} y={p.y} textAnchor="middle" dy="0.35em" className="font-mono text-[9px] font-bold" fill={err ? "#ef4444" : e.color}>
                    {err ? "429" : stats.busy[i]}
                  </text>
                  <text x={l.x} y={l.y + (vertical ? 0 : -3)} textAnchor={l.anchor} dy={vertical ? 0 : "0.1em"} className="text-[11px] font-semibold" fill={err ? "#f87171" : "#e8eaf2"}>
                    {e.name}
                  </text>
                  <text x={l.x} y={l.y + (vertical ? 12 : 10)} textAnchor={l.anchor} className="fill-muted font-mono text-[8.5px]">
                    {err ? "rate-limited · backing off" : `~${Math.round(e.lat * 1000)}ms`}
                  </text>
                </g>
              );
            })}
          </svg>
          <canvas ref={canvas} aria-hidden className="pointer-events-none absolute left-0 top-0 w-full" />
        </div>

        {/* ---------- log + stats ---------- */}
        <div className="flex flex-col gap-3">
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-line bg-[#07080d] p-4 font-mono text-[11px] leading-relaxed">
            <div className="mb-2 flex items-center gap-2 text-muted">
              <span className={`h-2 w-2 rounded-full ${brokenNow ? "animate-pulse bg-red-400" : "animate-pulse bg-[#4ade80]"}`} />
              limiter.log
              <span className="ml-auto text-muted/60">{manual ? "manual" : PHASES[stats.phase].name.toLowerCase()}</span>
            </div>
            <ul className="flex h-[236px] flex-col justify-end gap-1.5 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_28%)]">
              <AnimatePresence initial={false}>
                {logs.map((l) => (
                  <motion.li
                    key={l.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex gap-2"
                  >
                    <span className="shrink-0 text-muted/60">{fmt(l.t)}</span>
                    <span className="shrink-0" style={{ color: l.color }}>
                      {l.tag}
                    </span>
                    <span className={l.tone === "ok" ? "text-[#4ade80]" : l.tone === "bad" ? "text-red-400" : l.tone === "warn" ? "text-amber" : "text-fg/80"}>
                      {l.text}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              ["throughput", `${stats.tps}/s`, "text-cyan"],
              ["in flight", `${stats.inflight}/${SLOTS}`, "text-violet"],
              ["queued", stats.queued, stats.queued > 20 ? "text-amber" : "text-fg"],
              ["retried", stats.retried, stats.retried ? "text-amber" : "text-fg"],
            ].map(([k, v, cls]) => (
              <div key={k as string} className="rounded-xl border border-line bg-white/[0.02] px-1 py-2">
                <dd className={`font-mono text-sm font-semibold ${cls}`}>{v}</dd>
                <dt className="font-mono text-[9px] uppercase tracking-widest text-muted">{k}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
