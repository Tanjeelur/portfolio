"use client";

import { useEffect, useRef } from "react";

/**
 * Custom cursor (desktop / fine pointers only):
 * - a dot that tracks exactly, and a ring that trails with easing
 * - the ring grows over interactive elements and shows `data-cursor="label"` text
 * - elements marked `data-magnetic` lean toward the cursor
 */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine) return;
    document.documentElement.classList.add("has-cursor");

    const pos = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    let scale = 1;
    let targetScale = 1;
    let visible = false;
    let magnet: HTMLElement | null = null;
    let raf = 0;

    const releaseMagnet = () => {
      if (magnet) magnet.style.transform = "";
      magnet = null;
    };

    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!visible) {
        visible = true;
        ringPos.x = pos.x;
        ringPos.y = pos.y;
        if (dot.current) dot.current.style.opacity = "1";
        if (ring.current) ring.current.style.opacity = "1";
      }

      const target = e.target as HTMLElement | null;
      const interactive = target?.closest<HTMLElement>("a, button, [role=tab], input, label, [data-cursor]");
      const text = interactive?.closest<HTMLElement>("[data-cursor]")?.dataset.cursor ?? "";
      const pointerOnCanvas = document.body.style.cursor === "pointer"; // set by the 3D galaxy on hover
      if (label.current) label.current.textContent = text || (pointerOnCanvas ? "open" : "");
      targetScale = text || pointerOnCanvas ? 3.2 : interactive ? 1.9 : 1;

      // Magnetic elements
      const m = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
      if (m !== magnet) releaseMagnet();
      if (m && !reduced) {
        magnet = m;
        const r = m.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        m.style.transform = `translate(${dx * 0.3}px, ${dy * 0.4}px)`;
      }
    };
    const onLeave = () => {
      visible = false;
      if (dot.current) dot.current.style.opacity = "0";
      if (ring.current) ring.current.style.opacity = "0";
      releaseMagnet();
    };
    const onDown = () => (targetScale *= 0.8);
    const onUp = () => (targetScale /= 0.8);

    const loop = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      scale += (targetScale - scale) * 0.18;
      // Elements can be briefly missing while React rebuilds the tree: skip the frame, don't crash
      const d = dot.current;
      const r = ring.current;
      const l = label.current;
      if (d && r && l) {
        d.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;
        r.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) translate(-50%, -50%) scale(${scale})`;
        l.style.transform = `scale(${1 / scale})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] hidden [.has-cursor_&]:block">
      <div
        ref={ring}
        className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full border border-cyan/60 opacity-0 mix-blend-difference transition-opacity duration-300"
      >
        <span
          ref={label}
          className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-widest text-cyan"
        />
      </div>
      <div ref={dot} className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-cyan opacity-0" />
    </div>
  );
}
