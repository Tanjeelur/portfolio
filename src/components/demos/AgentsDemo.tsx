"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * GEO "Analyze & Fix" engine as a live crew graph:
 * three CrewAI agents (glowing orbs) pass message packets along edges, fire tool calls,
 * stream a run log, then fan out content to 12 channels behind a compliance check.
 * Auto-runs when scrolled into view and replays while visible.
 */

type AgentState = "idle" | "working" | "done";
type Pt = { x: number; y: number };

const AGENTS = [
  { name: "Diagnostician", role: "root cause", tag: "Dx", color: "#5eead4" },
  { name: "Strategist", role: "fix plan", tag: "St", color: "#a78bfa" },
  { name: "Writer", role: "content", tag: "Wr", color: "#fbbf24" },
];
const CHANNELS = ["Blog", "LinkedIn", "X", "Reddit", "Quora", "FAQ", "Docs", "Email", "YouTube", "Medium", "Press", "Schema"];
const ISSUE = "Brand missing from ChatGPT & Perplexity answers for “best CRM for startups”";

/* ---------- layouts (wide: left→right, narrow: top→bottom) ---------- */
function layout(vertical: boolean) {
  if (!vertical) {
    return {
      vb: "0 0 720 360",
      issue: { x: 62, y: 180 },
      agents: [
        { x: 215, y: 92 },
        { x: 345, y: 262 },
        { x: 478, y: 150 },
      ],
      channels: CHANNELS.map((_, i) => ({ x: 655, y: 24 + i * 28 })),
      chW: 82,
    };
  }
  return {
    vb: "0 0 360 560",
    issue: { x: 180, y: 28 },
    agents: [
      { x: 92, y: 128 },
      { x: 268, y: 228 },
      { x: 180, y: 330 },
    ],
    channels: CHANNELS.map((_, i) => ({ x: 50 + (i % 4) * 87, y: 440 + Math.floor(i / 4) * 40 })),
    chW: 78,
  };
}

function curve(a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const mx = a.x + dx / 2;
    return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
  }
  const my = a.y + dy / 2;
  return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
}

/* ---------- a comet-like packet travelling along a rendered path ---------- */
function Packet({ path, color, duration, onDone }: { path: SVGPathElement | null; color: string; duration: number; onDone: () => void }) {
  const g = useRef<SVGGElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!path || !g.current) return;
    const len = path.getTotalLength();
    const dots = Array.from(g.current.children) as SVGCircleElement[];
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      dots.forEach((d, k) => {
        const p = path.getPointAtLength(len * Math.max(0, e - k * 0.035));
        d.setAttribute("cx", `${p.x}`);
        d.setAttribute("cy", `${p.y}`);
      });
      if (t < 1) raf = requestAnimationFrame(tick);
      else done.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [path, duration]);
  return (
    <g ref={g} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
      {[4, 3.2, 2.4, 1.6].map((r, k) => (
        <circle key={k} r={r} cx={-99} cy={-99} fill={k ? color : "#fff"} opacity={1 - k * 0.22} />
      ))}
    </g>
  );
}

/* ---------- agent orb ---------- */
function AgentOrb({ at, agent, state, vertical }: { at: Pt; agent: (typeof AGENTS)[number]; state: AgentState; vertical: boolean }) {
  const c = agent.color;
  const working = state === "working";
  return (
    <g transform={`translate(${at.x},${at.y})`}>
      {/* halo */}
      <circle r={46} fill={`url(#halo-${agent.tag})`} opacity={working ? 1 : state === "done" ? 0.45 : 0.18}>
        {working && <animate attributeName="r" values="40;52;40" dur="1.6s" repeatCount="indefinite" />}
      </circle>
      {/* orbiting "thoughts" */}
      {working && (
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3.2s" repeatCount="indefinite" />
          {[0, 72, 144, 216, 288].map((a, i) => (
            <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 38} cy={Math.sin((a * Math.PI) / 180) * 38} r={i % 2 ? 1.8 : 2.6} fill={c} />
          ))}
        </g>
      )}
      {/* spinner arc */}
      {working && (
        <circle r={33} fill="none" stroke={c} strokeWidth={1.5} strokeDasharray="40 170" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="1.1s" repeatCount="indefinite" />
        </circle>
      )}
      {/* core */}
      <circle r={27} fill="#0b0e16" stroke={c} strokeWidth={state === "idle" ? 1 : 2} strokeOpacity={state === "idle" ? 0.35 : 1} />
      <text textAnchor="middle" dy="0.35em" fill={c} opacity={state === "idle" ? 0.5 : 1} className="font-mono text-[13px] font-bold">
        {agent.tag}
      </text>
      {/* done badge */}
      <AnimatePresence>
        {state === "done" && (
          <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
            <g transform="translate(20,-20)">
              <circle r={9} fill="#4ade80" />
              <path d="M-4 0 L-1 3 L4 -3" stroke="#05060a" strokeWidth={2} fill="none" strokeLinecap="round" />
            </g>
          </motion.g>
        )}
      </AnimatePresence>
      <text y={vertical ? 46 : 48} textAnchor="middle" className="fill-fg text-[12px] font-semibold">
        {agent.name}
      </text>
      <text y={vertical ? 59 : 61} textAnchor="middle" className="fill-muted font-mono text-[9px] uppercase tracking-widest">
        {working ? "thinking…" : agent.role}
      </text>
    </g>
  );
}

type Log = { id: number; t: number; who: number | "crew"; text: string; tone?: "ok" | "bad" };
type Tool = { id: number; agent: number; label: string };
type PacketSpec = { id: number; edge: string; color: string; dur: number };

export default function AgentsDemo() {
  const root = useRef<HTMLDivElement>(null);
  const paths = useRef<Record<string, SVGPathElement | null>>({});
  const arrivals = useRef<Record<number, () => void>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runId = useRef(0);
  const started = useRef(0);
  const inView = useRef(false);
  const seq = useRef(0);

  const [vertical, setVertical] = useState(false);
  const [agents, setAgents] = useState<AgentState[]>(["idle", "idle", "idle"]);
  const [activeEdges, setActiveEdges] = useState<string[]>([]);
  const [packets, setPackets] = useState<PacketSpec[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [lit, setLit] = useState<number[]>([]);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [stats, setStats] = useState({ elapsed: 0, tokens: 0, toolCalls: 0 });
  const tokenRate = useRef(0);

  const L = layout(vertical);

  /* ----- helpers bound to the current run ----- */
  const at = (ms: number, fn: () => void) => {
    const id = runId.current;
    timers.current.push(setTimeout(() => id === runId.current && fn(), ms));
  };
  const log = (who: Log["who"], text: string, tone?: Log["tone"]) =>
    setLogs((l) => [...l.slice(-7), { id: ++seq.current, t: performance.now() - started.current, who, text, tone }]);
  const tool = (agent: number, label: string) => {
    const id = ++seq.current;
    setTools((t) => [...t, { id, agent, label }]);
    setStats((s) => ({ ...s, toolCalls: s.toolCalls + 1 }));
    timers.current.push(setTimeout(() => setTools((t) => t.filter((x) => x.id !== id)), 1700));
  };
  const send = (edge: string, color: string, dur: number, onArrive?: () => void) => {
    const id = ++seq.current;
    if (onArrive) arrivals.current[id] = onArrive;
    setPackets((p) => [...p, { id, edge, color, dur }]);
  };
  const setAgent = (i: number, s: AgentState) => setAgents((a) => a.map((v, k) => (k === i ? s : v)));

  const run = useCallback(() => {
    runId.current++;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    arrivals.current = {};
    started.current = performance.now();
    setAgents(["idle", "idle", "idle"]);
    setActiveEdges([]);
    setPackets([]);
    setTools([]);
    setLogs([]);
    setLit([]);
    setStats({ elapsed: 0, tokens: 0, toolCalls: 0 });
    setPhase("running");
    tokenRate.current = 0;

    const [D, S, W] = AGENTS;
    log("crew", "crew.kickoff(task = visibility_fix)");
    setActiveEdges(["e0"]);
    send("e0", "#e8eaf2", 650, () => {
      setAgent(0, "working");
      tokenRate.current = 420;
    });

    at(900, () => {
      tool(0, "serp_search ×6");
      log(0, "serp_search(“best CRM for startups”) across 6 engines");
    });
    at(1700, () => {
      tool(0, "citation_check");
      log(0, "14 competitor citations · brand cited 0×", "bad");
    });
    at(2450, () => {
      tool(0, "schema_audit");
      log(0, "pricing page has no Product / FAQ schema", "bad");
    });
    at(3150, () => {
      setAgent(0, "done");
      tokenRate.current = 90;
      log(0, "root cause → zero third-party citations for “startups”", "ok");
      log("crew", `handoff ${D.tag} → ${S.tag} · context 2.1k tok`);
      setActiveEdges(["e1"]);
      send("e1", D.color, 800, () => {
        setAgent(1, "working");
        tokenRate.current = 380;
      });
    });
    at(4250, () => {
      tool(1, "competitor_db");
      log(1, "top cited sources: G2, Capterra, r/startups");
    });
    at(5000, () => {
      tool(1, "prioritize");
      log(1, "plan: 4 actions · citations first · schema second", "ok");
    });
    at(5700, () => {
      setAgent(1, "done");
      tokenRate.current = 90;
      log("crew", `handoff ${S.tag} → ${W.tag} · plan + brand voice`);
      setActiveEdges(["e2"]);
      send("e2", S.color, 800, () => {
        setAgent(2, "working");
        tokenRate.current = 650;
      });
    });
    at(6750, () => {
      tool(2, "brand_voice");
      log(2, "drafting 12 channel-ready assets…");
      setActiveEdges(CHANNELS.map((_, i) => `f${i}`));
      CHANNELS.forEach((_, i) =>
        at(i * 120, () =>
          send(`f${i}`, W.color, 700, () => setLit((l) => (l.includes(i) ? l : [...l, i])))
        )
      );
    });
    at(8700, () => {
      tool(2, "compliance_check");
      log(2, "12/12 passed · every claim backed by a citation", "ok");
    });
    at(9400, () => {
      setAgent(2, "done");
      setActiveEdges([]);
      tokenRate.current = 0;
      setPhase("done");
      const secs = (performance.now() - started.current) / 1000;
      setStats((s) => ({ ...s, elapsed: secs }));
      log("crew", `done in ${secs.toFixed(1)}s · ready to publish`, "ok");
    });
    // Replay while it stays on screen
    at(15500, () => {
      if (inView.current) run();
    });
  }, []);

  /* ----- live counters ----- */
  useEffect(() => {
    if (phase !== "running") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let tokens = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      tokens += tokenRate.current * dt * (0.7 + Math.random() * 0.6);
      acc += dt;
      if (acc > 0.08) {
        acc = 0;
        setStats((s) => ({ ...s, elapsed: (now - started.current) / 1000, tokens: Math.round(tokens) }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  /* ----- responsive layout + auto-start on view ----- */
  useEffect(() => {
    const el = root.current!;
    const ro = new ResizeObserver(([e]) => setVertical(e.contentRect.width < 640));
    ro.observe(el);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([e]) => {
        inView.current = e.isIntersecting;
        if (e.isIntersecting && runId.current === 0) {
          if (reduced) {
            // Static end state
            runId.current = 1;
            setAgents(["done", "done", "done"]);
            setLit(CHANNELS.map((_, i) => i));
            setPhase("done");
          } else run();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    const t = timers;
    return () => {
      ro.disconnect();
      io.disconnect();
      t.current.forEach(clearTimeout);
    };
  }, [run]);

  const edgeD: Record<string, string> = {
    e0: curve({ x: L.issue.x + (vertical ? 0 : 46), y: L.issue.y + (vertical ? 14 : 0) }, L.agents[0]),
    e1: curve(L.agents[0], L.agents[1]),
    e2: curve(L.agents[1], L.agents[2]),
    ...Object.fromEntries(
      L.channels.map((c, i) => [`f${i}`, curve(L.agents[2], vertical ? { x: c.x, y: c.y - 11 } : { x: c.x - L.chW / 2, y: c.y })])
    ),
  };
  const edgeColor = (k: string) => (k === "e0" ? "#e8eaf2" : k === "e1" ? AGENTS[0].color : k === "e2" ? AGENTS[1].color : AGENTS[2].color);
  const fmt = (ms: number) => `${String(Math.floor(ms / 1000)).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}s`;

  return (
    <div ref={root}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3">
        <p className="font-mono text-xs">
          <span className="text-red-400">issue ›</span> <span className="text-fg/90">{ISSUE}</span>
        </p>
        <button
          onClick={run}
          data-magnetic
          className="rounded-full bg-cyan px-4 py-1.5 text-sm font-semibold text-bg"
        >
          {phase === "idle" ? "▶ Run crew" : phase === "running" ? "↻ Restart" : "↻ Re-run"}
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* ---------- graph ---------- */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-[radial-gradient(circle_at_50%_40%,#10131d,#07080d)]">
          <svg viewBox={L.vb} className="block w-full" role="img" aria-label="Three AI agents passing work along a pipeline and publishing to 12 channels">
            <defs>
              {AGENTS.map((a) => (
                <radialGradient key={a.tag} id={`halo-${a.tag}`}>
                  <stop offset="0%" stopColor={a.color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={a.color} stopOpacity={0} />
                </radialGradient>
              ))}
              <pattern id="crew-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M24 0H0V24" fill="none" stroke="rgba(255,255,255,0.035)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#crew-grid)" />

            {/* edges */}
            {Object.entries(edgeD).map(([k, d]) => {
              const active = activeEdges.includes(k);
              return (
                <g key={k}>
                  <path
                    ref={(el) => {
                      paths.current[k] = el;
                    }}
                    d={d}
                    fill="none"
                    stroke="rgba(255,255,255,0.09)"
                    strokeWidth={k.startsWith("f") ? 1 : 1.5}
                  />
                  {active && <path d={d} fill="none" stroke={edgeColor(k)} strokeOpacity={0.55} strokeWidth={1.5} className="crew-flow" />}
                </g>
              );
            })}

            {/* issue node */}
            <g transform={`translate(${L.issue.x},${L.issue.y})`}>
              <rect x={-46} y={-14} width={92} height={28} rx={14} fill="#1a0f12" stroke="#f87171" strokeOpacity={0.6} />
              <text textAnchor="middle" dy="0.35em" className="fill-red-400 font-mono text-[10px] font-semibold uppercase tracking-widest">
                issue
              </text>
            </g>

            {/* channels */}
            {L.channels.map((c, i) => {
              const on = lit.includes(i);
              return (
                <motion.g
                  key={CHANNELS[i]}
                  initial={false}
                  animate={on ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                  style={{ transformOrigin: `${c.x}px ${c.y}px`, transformBox: "view-box" }}
                >
                  <rect
                    x={c.x - L.chW / 2}
                    y={c.y - 11}
                    width={L.chW}
                    height={22}
                    rx={11}
                    fill={on ? "#2a2311" : "#0d1018"}
                    stroke={on ? "#fbbf24" : "rgba(255,255,255,0.12)"}
                    style={{ transition: "fill .3s, stroke .3s" }}
                  />
                  <text
                    x={c.x}
                    y={c.y}
                    textAnchor="middle"
                    dy="0.35em"
                    className="font-mono text-[10px]"
                    fill={on ? "#fbbf24" : "#8b90a5"}
                  >
                    {on ? "✓ " : ""}
                    {CHANNELS[i]}
                  </text>
                </motion.g>
              );
            })}

            {/* agents */}
            {AGENTS.map((a, i) => (
              <AgentOrb key={a.tag} at={L.agents[i]} agent={a} state={agents[i]} vertical={vertical} />
            ))}

            {/* tool calls popping out of the working agent */}
            <AnimatePresence>
              {tools.map((t) => {
                const p = L.agents[t.agent];
                const w = t.label.length * 6.4 + 18;
                return (
                  <motion.g
                    key={t.id}
                    initial={{ opacity: 0, y: 0, scale: 0.6 }}
                    animate={{ opacity: 1, y: -18, scale: 1 }}
                    exit={{ opacity: 0, y: -34 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    style={{ transformOrigin: `${p.x}px ${p.y - 50}px`, transformBox: "view-box" }}
                  >
                    <rect x={p.x - w / 2} y={p.y - 62} width={w} height={20} rx={6} fill="#0b0e16" stroke={AGENTS[t.agent].color} />
                    <text x={p.x} y={p.y - 52} textAnchor="middle" dy="0.35em" className="font-mono text-[10px]" fill={AGENTS[t.agent].color}>
                      ⚙ {t.label}
                    </text>
                  </motion.g>
                );
              })}
            </AnimatePresence>

            {/* packets */}
            {packets.map((p) => (
              <Packet
                key={p.id}
                path={paths.current[p.edge] ?? null}
                color={p.color}
                duration={p.dur}
                onDone={() => {
                  arrivals.current[p.id]?.();
                  delete arrivals.current[p.id];
                  setPackets((list) => list.filter((x) => x.id !== p.id));
                }}
              />
            ))}
          </svg>

          <AnimatePresence>
            {phase === "done" && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-3 left-3 rounded-full bg-[#4ade80]/15 px-3 py-1 font-mono text-[11px] text-[#4ade80] backdrop-blur"
              >
                ✓ compliance passed · ready to publish
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ---------- run log + stats ---------- */}
        <div className="flex flex-col gap-3">
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-line bg-[#07080d] p-4 font-mono text-[11px] leading-relaxed">
            <div className="mb-2 flex items-center gap-2 text-muted">
              <span className={`h-2 w-2 rounded-full ${phase === "running" ? "animate-pulse bg-[#4ade80]" : phase === "done" ? "bg-[#4ade80]" : "bg-white/20"}`} />
              crew.log
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
                    <span className="shrink-0" style={{ color: l.who === "crew" ? "#e8eaf2" : AGENTS[l.who].color }}>
                      {l.who === "crew" ? "crew" : AGENTS[l.who].tag}
                    </span>
                    <span className={l.tone === "ok" ? "text-[#4ade80]" : l.tone === "bad" ? "text-red-400" : "text-fg/80"}>
                      {l.text}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              ["elapsed", `${stats.elapsed.toFixed(1)}s`],
              ["tokens", stats.tokens.toLocaleString()],
              ["tools", stats.toolCalls],
              ["channels", `${lit.length}/12`],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl border border-line bg-white/[0.02] px-1 py-2">
                <dd className="font-mono text-sm font-semibold text-fg">{v}</dd>
                <dt className="font-mono text-[9px] uppercase tracking-widest text-muted">{k}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
