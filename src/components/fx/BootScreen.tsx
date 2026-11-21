"use client";

import { useEffect, useState } from "react";
import { markBooted } from "@/lib/boot";
import { profile } from "@/data/resume";

const LINES = [
  { text: "loading model weights", status: "bar" },
  { text: "compiling shaders", status: "ok" },
  { text: "warming up retriever", status: "ok" },
  { text: "spawning agents ×3", status: "ok" },
] as const;

/**
 * A ~1.5 s terminal "boot" overlay shown once per session. It hides the WebGL warm-up,
 * then wipes away and tells the particles to assemble.
 * Hidden without JS, and skipped for reduced motion / repeat visits (see the inline script in layout).
 */
export default function BootScreen() {
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (html.classList.contains("booted")) {
      setGone(true);
      markBooted();
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      // rAF timestamps can be slightly earlier than `start`, so clamp to 0..1
      const p = Math.max(0, Math.min(1, (now - start) / 700));
      setPct(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    LINES.forEach((_, i) => timers.push(setTimeout(() => setStep(i + 1), 250 + i * 260)));
    timers.push(
      setTimeout(() => {
        setStep(LINES.length + 1);
      }, 1350)
    );
    timers.push(
      setTimeout(() => {
        setLeaving(true);
        markBooted();
        try {
          sessionStorage.setItem("booted", "1");
        } catch {}
      }, 1650)
    );
    timers.push(setTimeout(() => setGone(true), 2500));
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (gone) return null;

  const filled = Math.max(0, Math.min(10, Math.round(pct / 10)));
  const bar = "█".repeat(filled).padEnd(10, "░");

  return (
    <div
      aria-hidden
      className="boot fixed inset-0 z-[90] hidden items-center justify-center bg-bg px-6 transition-[clip-path] duration-[850ms] ease-[cubic-bezier(0.76,0,0.24,1)]"
      style={{ clipPath: leaving ? "inset(0 0 100% 0)" : "inset(0 0 0% 0)" }}
    >
      <div className="w-full max-w-md font-mono text-xs leading-6 text-muted sm:text-sm">
        <p className="text-fg">
          <span className="text-cyan">❯</span> {profile.shortName.toLowerCase()}.ai --boot
        </p>
        {LINES.map((l, i) => (
          <p key={l.text} className={`transition-opacity duration-200 ${step > i ? "opacity-100" : "opacity-0"}`}>
            <span className="inline-block w-[23ch]">{l.text.padEnd(22, ".")}</span>{" "}
            {l.status === "bar" ? (
              <span className="text-cyan">
                {bar} {pct}%
              </span>
            ) : (
              <span className="text-[#4ade80]">ok</span>
            )}
          </p>
        ))}
        <p className={`text-fg transition-opacity duration-200 ${step > LINES.length ? "opacity-100" : "opacity-0"}`}>
          ready<span className="ml-1 inline-block h-3.5 w-2 animate-pulse bg-cyan align-middle" />
        </p>
      </div>
    </div>
  );
}
