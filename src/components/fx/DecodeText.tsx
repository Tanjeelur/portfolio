"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/<>";

/** Text that "decodes" from random glyphs into the real string when it scrolls into view. */
export default function DecodeText({ text, className }: { text: string; className?: string }) {
  const [out, setOut] = useState(text);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current!;
    let raf = 0;
    const scramble = () =>
      text
        .split("")
        .map((c) => (c === " " || c === "/" ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
        .join("");
    setOut(scramble());

    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 900;
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const revealed = Math.floor(p * text.length);
          setOut(
            text
              .split("")
              .map((c, i) =>
                i < revealed || c === " " || c === "/" ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
              )
              .join("")
          );
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [text]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  );
}
