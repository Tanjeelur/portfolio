"use client";

import { useRef } from "react";
import type { Project } from "@/data/resume";

const accentVar = { cyan: "var(--cyan)", violet: "var(--violet)", amber: "var(--amber)" };

/** Card with a cursor-following spotlight and a subtle 3D tilt. */
export default function ProjectCard({ project }: { project: Project }) {
  const ref = useRef<HTMLElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 6}deg)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  const accent = accentVar[project.accent];

  return (
    <article
      ref={ref}
      data-reveal
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ "--accent": accent } as React.CSSProperties}
      className="spotlight glass flex flex-col rounded-2xl p-6 transition-transform duration-300 ease-out will-change-transform"
    >
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest">
        <span style={{ color: accent }}>{project.kind}</span>
        <span className="text-muted">{project.year}</span>
      </div>
      <h3 className="mt-4 text-2xl font-semibold">{project.title}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{project.description}</p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {project.stack.map((s) => (
          <li key={s} className="rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-fg/70">
            {s}
          </li>
        ))}
      </ul>
      {project.url && (
        <a
          href={project.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: accent }}
        >
          Visit live ↗
        </a>
      )}
    </article>
  );
}
