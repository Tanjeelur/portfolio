"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { projects } from "@/data/resume";
import ProjectCard from "@/components/sections/ProjectCard";
import { NAV_EVENTS } from "@/lib/nav";

const GalaxyCanvas = dynamic(() => import("./GalaxyCanvas"), { ssr: false });

const COLORS = { cyan: "var(--cyan)", violet: "var(--violet)", amber: "var(--amber)" } as const;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** 3D "embedding galaxy" of projects with a detail panel; falls back to a card grid without WebGL. */
export default function ProjectExplorer() {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setWebgl(hasWebGL()), []);

  // Command palette → open a project star
  useEffect(() => {
    const onSelect = (e: Event) => setSelected((e as CustomEvent<number>).detail);
    window.addEventListener(NAV_EVENTS.selectProject, onSelect);
    return () => window.removeEventListener(NAV_EVENTS.selectProject, onSelect);
  }, []);

  // Only render the 3D scene while it's on screen
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, [webgl]);

  const step = useCallback(
    (d: number) => setSelected((s) => (s === null ? 0 : (s + d + projects.length) % projects.length)),
    []
  );

  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, step]);

  if (webgl === false) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <ProjectCard key={p.title} project={p} />
        ))}
      </div>
    );
  }

  const p = selected !== null ? projects[selected] : null;

  return (
    <div
      ref={wrap}
      id="galaxy"
      data-reveal
      className="glass relative h-[78svh] max-h-[820px] min-h-[560px] overflow-hidden rounded-3xl"
    >
      {/* `isolate` keeps the 3D labels in their own layer, under the panel and chips */}
      <div className="absolute inset-0 isolate">
        {webgl && (
          <GalaxyCanvas
            active={inView}
            selected={selected}
            hovered={hovered}
            onSelect={(i) => setSelected((s) => (s === i ? null : i))}
            onHover={setHovered}
          />
        )}
      </div>

      {/* Hint */}
      <AnimatePresence>
        {selected === null && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute left-5 top-5 font-mono text-[11px] uppercase tracking-widest text-muted"
          >
            {projects.length} projects · 3 clusters · click a star
          </motion.p>
        )}
      </AnimatePresence>

      {/* Accessible project picker (also the keyboard path into the galaxy) */}
      <nav
        aria-label="Projects"
        className={`absolute inset-x-0 bottom-0 flex gap-2 overflow-x-auto p-4 transition-opacity duration-300 [scrollbar-width:none] ${
          selected !== null ? "pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100" : ""
        }`}
      >
        {projects.map((proj, i) => (
          <button
            key={proj.title}
            onClick={() => setSelected(i)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="glass shrink-0 rounded-full px-3.5 py-1.5 text-xs transition-colors hover:text-fg"
            style={{
              color: selected === i ? COLORS[proj.accent] : undefined,
              borderColor: selected === i ? COLORS[proj.accent] : undefined,
            }}
          >
            {proj.title}
          </button>
        ))}
      </nav>

      {/* Detail panel: right side on desktop, bottom sheet on mobile */}
      <AnimatePresence mode="wait">
        {p && (
          <motion.aside
            key={p.title}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            data-lenis-prevent
            className="scroll-fade absolute inset-x-3 bottom-3 z-30 max-h-[55%] overflow-y-auto rounded-2xl border border-line bg-bg/85 p-5 pb-7 backdrop-blur-xl md:inset-x-auto md:bottom-auto md:right-5 md:top-5 md:max-h-[calc(100%-2.5rem)] md:w-[380px] md:p-6 md:pb-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: COLORS[p.accent] }}>
                {p.kind} · {p.year}
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close project details"
                className="-mr-1 -mt-1 rounded-full px-2 text-lg leading-none text-muted hover:text-fg"
              >
                ×
              </button>
            </div>
            <h3 className="mt-2 text-2xl font-semibold">{p.title}</h3>
            <p className="mt-2 text-sm text-muted">{p.description}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {p.highlights.map((h) => (
                <li key={h} className="flex gap-2.5 text-fg/85">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: COLORS[p.accent] }} />
                  {h}
                </li>
              ))}
            </ul>
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {p.stack.map((s) => (
                <li key={s} className="rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-fg/70">
                  {s}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between gap-3">
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  data-cursor="visit"
                  className="text-sm font-medium hover:underline"
                  style={{ color: COLORS[p.accent] }}
                >
                  Visit live ↗
                </a>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => step(-1)}
                  aria-label="Previous project"
                  className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-fg"
                >
                  ←
                </button>
                <button
                  onClick={() => step(1)}
                  aria-label="Next project"
                  className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-fg"
                >
                  →
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
