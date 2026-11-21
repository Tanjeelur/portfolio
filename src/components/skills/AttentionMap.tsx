"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { experience, projects, skills } from "@/data/resume";
import { NAV_EVENTS } from "@/lib/nav";

/**
 * Skills as a transformer-style attention map: focus a skill (hover / tap / keyboard) and
 * weighted links light up to every project and job that used it — or focus a project to see
 * its skills. Idles by cycling through skills while on screen.
 */

type Target = { id: string; label: string; sub: string; text: string };

const TARGETS: Target[] = [
  ...projects.map((p) => ({
    id: `p:${p.title}`,
    label: p.title,
    sub: p.kind,
    text: [p.title, p.description, ...p.stack, ...p.highlights].join(" "),
  })),
  ...experience.map((e) => ({
    id: `e:${e.company}`,
    label: e.company,
    sub: e.role,
    text: [e.company, ...e.stack, ...e.highlights].join(" "),
  })),
];

const ALIASES: Record<string, string[]> = {
  "YOLOv8/v11": ["YOLOv8", "YOLOv11"],
  RRF: ["Reciprocal Rank Fusion", "RRF"],
  Transformers: ["Transformers", "GPT-4o"],
  "Hugging Face": ["Hugging Face", "sentence-transformers"],
  "AWS EC2": ["AWS"],
  Anthropic: ["Anthropic", "Claude"],
  OpenAI: ["OpenAI", "GPT-4o", "ChatGPT"],
  "GitHub Actions": ["GitHub Actions"],
  asyncio: ["asyncio", "async"],
  SSE: ["SSE"],
};

function weight(skill: string, t: Target) {
  const terms = ALIASES[skill] ?? [skill];
  const hay = t.text.toLowerCase();
  let n = 0;
  for (const term of terms) {
    // whole-token match so e.g. "SSE" doesn't hit "processed"
    const esc = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, "g");
    n += (hay.match(re) || []).length;
  }
  return n;
}

const ALL_SKILLS = Object.values(skills).flat();

type Line = { d: string; w: number; key: string };

export default function AttentionMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLElement | null>>({});
  const targetRefs = useRef<Record<string, HTMLElement | null>>({});
  const [focusSkill, setFocusSkill] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [autoSkill, setAutoSkill] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // skill -> target weights
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const s of ALL_SKILLS) {
      m[s] = {};
      for (const t of TARGETS) {
        const w = weight(s, t);
        if (w) m[s][t.id] = w;
      }
    }
    return m;
  }, []);

  const activeSkill = focusSkill ?? (focusTarget ? null : autoSkill);
  const pairs = useMemo(() => {
    if (activeSkill) return Object.entries(matrix[activeSkill]).map(([t, w]) => ({ s: activeSkill, t, w }));
    if (focusTarget)
      return ALL_SKILLS.filter((s) => matrix[s][focusTarget]).map((s) => ({ s, t: focusTarget, w: matrix[s][focusTarget] }));
    return [];
  }, [activeSkill, focusTarget, matrix]);

  const litSkills = new Set(pairs.map((p) => p.s));
  const litTargets = new Set(pairs.map((p) => p.t));

  const measure = useCallback(() => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    setSize({ w: box.width, h: box.height });
    const next: Line[] = [];
    for (const { s, t, w } of pairs) {
      const a = chipRefs.current[s]?.getBoundingClientRect();
      const b = targetRefs.current[t]?.getBoundingClientRect();
      if (!a || !b) continue;
      let d: string;
      if (b.left >= a.right - 4) {
        // side by side: right edge of chip -> left edge of target
        const x1 = a.right - box.left;
        const y1 = a.top + a.height / 2 - box.top;
        const x2 = b.left - box.left;
        const y2 = b.top + b.height / 2 - box.top;
        const mx = (x1 + x2) / 2;
        d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      } else {
        // stacked: bottom of chip -> top of target
        const x1 = a.left + a.width / 2 - box.left;
        const y1 = a.bottom - box.top;
        const x2 = b.left + b.width / 2 - box.left;
        const y2 = b.top - box.top;
        const my = (y1 + y2) / 2;
        d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
      }
      next.push({ d, w, key: `${s}->${t}` });
    }
    setLines(next);
  }, [pairs]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [measure]);

  // Command palette → light up a skill
  useEffect(() => {
    const onFocus = (e: Event) => {
      setFocusTarget(null);
      setFocusSkill((e as CustomEvent<string>).detail);
    };
    window.addEventListener(NAV_EVENTS.focusSkill, onFocus);
    return () => window.removeEventListener(NAV_EVENTS.focusSkill, onFocus);
  }, []);

  // Idle demo: cycle through well-connected skills while visible and untouched
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const showcase = ALL_SKILLS.filter((s) => Object.keys(matrix[s]).length >= 2);
    let i = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(timer);
      if (!e.isIntersecting) return setAutoSkill(null);
      setAutoSkill(showcase[i % showcase.length]);
      timer = setInterval(() => setAutoSkill(showcase[++i % showcase.length]), 2200);
    }, { threshold: 0.4 });
    if (wrap.current) io.observe(wrap.current);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, [matrix]);

  const maxW = Math.max(1, ...lines.map((l) => l.w));

  return (
    <div ref={wrap} className="relative" onMouseLeave={() => { setFocusSkill(null); setFocusTarget(null); }}>
      <svg aria-hidden className="pointer-events-none absolute inset-0 z-0" width={size.w} height={size.h}>
        <defs>
          <linearGradient id="attn" x1="0" x2="1">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        {lines.map((l) => (
          <path
            key={l.key}
            d={l.d}
            pathLength={1}
            fill="none"
            stroke="url(#attn)"
            strokeWidth={1 + (l.w / maxW) * 2.5}
            strokeOpacity={0.35 + (l.w / maxW) * 0.55}
            className="attn-line"
          />
        ))}
      </svg>

      <div className="relative z-10 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-24">
        {/* Skills (queries) */}
        <div className="space-y-7">
          {Object.entries(skills).map(([group, items]) => (
            <div key={group} data-reveal>
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-cyan">{group}</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {items.map((s) => {
                  const lit = litSkills.has(s);
                  const n = Object.keys(matrix[s]).length;
                  return (
                    <li key={s}>
                      <button
                        ref={(el) => {
                          chipRefs.current[s] = el;
                        }}
                        onMouseEnter={() => setFocusSkill(s)}
                        onFocus={() => setFocusSkill(s)}
                        onBlur={() => setFocusSkill(null)}
                        onClick={() => setFocusSkill((cur) => (cur === s ? null : s))}
                        aria-pressed={focusSkill === s}
                        className={`rounded-full border bg-bg px-3 py-1.5 text-sm transition-all duration-300 ${
                          lit
                            ? "border-cyan !bg-[#0b1f1d] text-cyan shadow-[0_0_20px_-6px_var(--cyan)]"
                            : pairs.length
                              ? "border-line text-fg/40"
                              : "border-line text-fg/85"
                        }`}
                      >
                        {s}
                        {n > 0 && <sup className="ml-1 font-mono text-[9px] text-muted">{n}</sup>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Projects & jobs (keys) */}
        <div data-reveal>
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-violet">Where it was used</h3>
          <ul className="mt-3 space-y-2">
            {TARGETS.map((t) => {
              const lit = litTargets.has(t.id);
              return (
                <li key={t.id}>
                  <button
                    ref={(el) => {
                      targetRefs.current[t.id] = el;
                    }}
                    onMouseEnter={() => {
                      setFocusSkill(null);
                      setFocusTarget(t.id);
                    }}
                    onFocus={() => setFocusTarget(t.id)}
                    onBlur={() => setFocusTarget(null)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-bg px-4 py-2.5 text-left transition-all duration-300 ${
                      lit ? "border-violet/70 !bg-[#16132a]" : pairs.length ? "border-line opacity-45" : "border-line"
                    }`}
                  >
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.sub}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 font-mono text-[11px] text-muted">
            {activeSkill
              ? `attention(“${activeSkill}”) → ${pairs.length} ${pairs.length === 1 ? "match" : "matches"}`
              : focusTarget
                ? `${pairs.length} skills attend to this`
                : "hover a skill or a project"}
          </p>
        </div>
      </div>
    </div>
  );
}
