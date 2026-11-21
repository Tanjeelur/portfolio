"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { experience } from "@/data/resume";

/**
 * Desktop Experience view: the section sticks while you scroll and a training curve draws
 * itself. Each job is a checkpoint; its card swaps in when the curve reaches it.
 */

const JOBS = [...experience].reverse(); // chronological
const CHECKPOINTS = [0.1, 0.43, 0.76];
const DATES = ["Feb '25", "Jun '25", "Dec '25", "now"];
const W = 560;
const H = 300;
const PAD = { l: 36, r: 12, t: 16, b: 30 };

function loss(x: number) {
  // Decays overall, with a small bump at each new job (fine-tuning on a new task)
  let v = 0.12 + 0.8 * Math.exp(-3 * x);
  for (const c of CHECKPOINTS.slice(1)) v += 0.09 * Math.exp(-Math.pow((x - c - 0.03) / 0.035, 2));
  return v + 0.012 * Math.sin(x * 70);
}
function acc(x: number) {
  let v = 0.32 + 0.62 * (1 - Math.exp(-3.2 * x));
  for (const c of CHECKPOINTS.slice(1)) v -= 0.05 * Math.exp(-Math.pow((x - c - 0.03) / 0.04, 2));
  return v + 0.008 * Math.sin(x * 53 + 1);
}

const sx = (x: number) => PAD.l + x * (W - PAD.l - PAD.r);
const sy = (y: number) => PAD.t + (1 - y) * (H - PAD.t - PAD.b);

function path(fn: (x: number) => number) {
  const pts: string[] = [];
  for (let i = 0; i <= 160; i++) {
    const x = i / 160;
    pts.push(`${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(fn(x)).toFixed(1)}`);
  }
  return pts.join("");
}

export default function TrainingRun() {
  const section = useRef<HTMLDivElement>(null);
  const lossRef = useRef<SVGPathElement>(null);
  const accRef = useRef<SVGPathElement>(null);
  const headLoss = useRef<SVGCircleElement>(null);
  const headAcc = useRef<SVGCircleElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const lossD = useMemo(() => path(loss), []);
  const accD = useMemo(() => path(acc), []);

  useEffect(() => {
    const el = section.current!;
    const lp = lossRef.current!;
    const ap = accRef.current!;
    const lLen = lp.getTotalLength();
    const aLen = ap.getTotalLength();
    lp.style.strokeDasharray = `${lLen}`;
    ap.style.strokeDasharray = `${aLen}`;
    let raf = 0;
    let shown = -1;

    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      // small lead-in so the first checkpoint is visible as soon as the section pins
      const p = Math.min(1, Math.max(0.02, -r.top / Math.max(1, total)));
      lp.style.strokeDashoffset = `${lLen * (1 - p)}`;
      ap.style.strokeDashoffset = `${aLen * (1 - p)}`;
      headLoss.current?.setAttribute("cx", `${sx(p)}`);
      headLoss.current?.setAttribute("cy", `${sy(loss(p))}`);
      headAcc.current?.setAttribute("cx", `${sx(p)}`);
      headAcc.current?.setAttribute("cy", `${sy(acc(p))}`);
      if (readout.current) readout.current.textContent = `epoch ${(p * 3).toFixed(2)} · loss ${loss(p).toFixed(3)} · val_acc ${acc(p).toFixed(3)}`;
      let idx = 0;
      CHECKPOINTS.forEach((c, i) => {
        if (p >= c) idx = i;
      });
      if (idx !== shown) {
        shown = idx;
        setActive(idx);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const job = JOBS[active];

  return (
    <div ref={section} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-svh items-center">
        <div className="grid w-full grid-cols-[1.15fr_1fr] items-center gap-10">
          {/* Chart */}
          <div className="glass rounded-3xl p-6">
            <div className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-widest">
              <span className="text-muted">training run · career.fit()</span>
              <span className="flex gap-4">
                <span className="text-cyan">— loss</span>
                <span className="text-violet">— val_acc</span>
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
              {/* grid */}
              {[0, 0.25, 0.5, 0.75, 1].map((g) => (
                <line key={g} x1={PAD.l} x2={W - PAD.r} y1={sy(g)} y2={sy(g)} stroke="rgba(255,255,255,0.06)" />
              ))}
              {[0, 0.5, 1].map((g) => (
                <text key={g} x={PAD.l - 8} y={sy(g) + 3} textAnchor="end" className="fill-muted font-mono text-[10px]">
                  {g.toFixed(1)}
                </text>
              ))}
              {/* checkpoints */}
              {CHECKPOINTS.map((c, i) => (
                <g key={c}>
                  <line
                    x1={sx(c)}
                    x2={sx(c)}
                    y1={PAD.t}
                    y2={H - PAD.b}
                    stroke={i <= active ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.08)"}
                    strokeDasharray="3 4"
                    style={{ transition: "stroke 0.4s" }}
                  />
                  <text x={sx(c)} y={H - 10} textAnchor="middle" className="fill-muted font-mono text-[10px]">
                    {DATES[i]}
                  </text>
                  <circle
                    cx={sx(c)}
                    cy={PAD.t + 2}
                    r={4}
                    fill={i <= active ? "#fbbf24" : "#1b2033"}
                    style={{ transition: "fill 0.4s" }}
                  />
                </g>
              ))}
              <text x={W - PAD.r} y={H - 10} textAnchor="end" className="fill-muted font-mono text-[10px]">
                {DATES[3]}
              </text>
              {/* curves */}
              <path ref={accRef} d={accD} fill="none" stroke="#a78bfa" strokeWidth={2} style={{ filter: "drop-shadow(0 0 6px #a78bfa)" }} />
              <path ref={lossRef} d={lossD} fill="none" stroke="#5eead4" strokeWidth={2} style={{ filter: "drop-shadow(0 0 6px #5eead4)" }} />
              <circle ref={headAcc} r={4.5} fill="#a78bfa" />
              <circle ref={headLoss} r={4.5} fill="#5eead4" />
            </svg>
            <span ref={readout} className="mt-2 block font-mono text-[11px] text-muted" />
          </div>

          {/* Active checkpoint */}
          <div className="relative min-h-[380px]">
            <AnimatePresence mode="wait">
              <motion.article
                key={job.company}
                initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -30, filter: "blur(6px)" }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="font-mono text-xs uppercase tracking-widest text-amber">
                  checkpoint {active + 1}/{JOBS.length} · {job.period}
                </p>
                <h3 className="mt-3 text-3xl font-semibold">
                  {job.role} <span className="text-muted">@</span> <span className="text-gradient">{job.company}</span>
                </h3>
                <ul className="mt-5 space-y-3 text-muted">
                  {job.highlights.map((h) => (
                    <li key={h} className="flex gap-3">
                      <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-cyan" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {job.stack.map((s) => (
                    <li key={s} className="rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-fg/70">
                      {s}
                    </li>
                  ))}
                </ul>
              </motion.article>
            </AnimatePresence>
            {/* progress dots */}
            <div className="mt-8 flex gap-2">
              {JOBS.map((j, i) => (
                <span
                  key={j.company}
                  className={`h-1 rounded-full transition-all duration-500 ${i === active ? "w-10 bg-amber" : i < active ? "w-4 bg-amber/40" : "w-4 bg-white/10"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
