"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const COLORS = ["#5eead4", "#a78bfa", "#fbbf24", "#f472b6"];

/** Big email address + a copy button that bursts into particles when clicked. */
export default function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const burst = () => {
    const el = btn.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 26; i++) {
      const p = document.createElement("span");
      const size = 3 + Math.random() * 4;
      Object.assign(p.style, {
        position: "fixed",
        left: `${r.left + r.width / 2}px`,
        top: `${r.top + r.height / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "999px",
        background: COLORS[i % COLORS.length],
        boxShadow: `0 0 8px ${COLORS[i % COLORS.length]}`,
        pointerEvents: "none",
        zIndex: "80",
      });
      document.body.appendChild(p);
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 90;
      p.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0)`,
            opacity: 0,
          },
        ],
        { duration: 700 + Math.random() * 400, easing: "cubic-bezier(0.22,1,0.36,1)" }
      ).onfinish = () => p.remove();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the address is still visible to copy by hand
    }
    burst();
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="mt-10 flex flex-col items-center gap-5">
      <a
        href={`mailto:${email}`}
        data-cursor="write"
        className="break-all font-mono text-lg text-fg underline decoration-cyan decoration-2 underline-offset-8 transition-colors hover:text-cyan sm:text-2xl"
      >
        {email}
      </a>
      <button
        ref={btn}
        onClick={copy}
        data-magnetic
        className="relative rounded-full bg-cyan px-6 py-3 text-sm font-semibold text-bg"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "done" : "idle"}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="block"
          >
            {copied ? "✓ Copied to clipboard" : "Copy email"}
          </motion.span>
        </AnimatePresence>
      </button>
      <span role="status" className="sr-only">
        {copied ? "Email copied to clipboard" : ""}
      </span>
    </div>
  );
}
