"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { profile } from "@/data/resume";
import { scrollState } from "@/lib/scrollState";
import { emit, NAV_EVENTS, scrollToId, SECTIONS } from "@/lib/nav";
import CommandPalette from "@/components/nav/CommandPalette";

/**
 * "Dynamic island" navigation: one small pill that shows where you are (section, progress ring,
 * a context-aware chip) and morphs open into the full menu on hover / tap.
 * Sits at the top on desktop and at the bottom (thumb reach) on phones.
 */
export default function Nav() {
  const [active, setActive] = useState("top");
  const [open, setOpen] = useState(false);
  const [touch, setTouch] = useState(false);
  const [copied, setCopied] = useState(false);
  const ring = useRef<SVGCircleElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTouch(!window.matchMedia("(pointer: fine)").matches);
    const onSection = (e: Event) => setActive((e as CustomEvent<string>).detail);
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? window.scrollY / max : 0;
        if (ring.current) ring.current.style.strokeDashoffset = `${2 * Math.PI * 8 * (1 - p)}`;
      });
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    setActive(scrollState.section);
    onScroll();
    window.addEventListener("sectionchange", onSection);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("sectionchange", onSection);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      cancelAnimationFrame(raf);
    };
  }, []);

  const idx = Math.max(0, SECTIONS.findIndex((s) => s.id === active));
  const current = SECTIONS[idx];

  const go = (id: string) => {
    setOpen(false);
    scrollToId(id);
  };
  const copy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(profile.email);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const search = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen(false);
    emit(NAV_EVENTS.openPalette);
  };

  // Context chip on the right of the collapsed pill
  const chip = (() => {
    if (copied) return <span className="text-[#4ade80]">✓ copied</span>;
    if (active === "contact")
      return (
        <button onClick={copy} className="text-cyan hover:text-fg">
          copy email
        </button>
      );
    if (active === "demos")
      return (
        <span className="flex items-center gap-1.5 text-[#4ade80]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ade80]" /> live
        </span>
      );
    if (active === "projects") return <span className="text-muted">6 stars</span>;
    if (active === "research") return <span className="text-amber">IEEE ’25</span>;
    return (
      <button onClick={search} className="flex items-center gap-1 text-muted hover:text-fg" aria-label="Open search">
        {touch ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        ) : (
          <kbd className="rounded border border-line px-1.5 py-px text-[10px]">⌘K</kbd>
        )}
      </button>
    );
  })();

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-auto md:top-4">
        <motion.nav
          ref={root}
          layout
          aria-label="Main"
          onMouseEnter={() => {
            if (touch) return;
            clearTimeout(closeTimer.current);
            setOpen(true);
          }}
          onMouseLeave={() => {
            if (touch) return;
            closeTimer.current = setTimeout(() => setOpen(false), 220);
          }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          style={{ borderRadius: open ? 24 : 999 }}
          className="pointer-events-auto relative flex w-auto max-w-full flex-col-reverse overflow-hidden border border-line bg-[rgba(10,12,19,0.82)] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl md:flex-col"
        >
          {/* ---------- collapsed pill (always visible) ---------- */}
          <motion.div layout="position" className="flex items-center gap-3 py-2 pl-2 pr-4 font-mono text-[11px]">
            <button
              onClick={() => (touch ? setOpen((o) => !o) : go("top"))}
              aria-expanded={open}
              aria-label={touch ? "Toggle menu" : "Back to top"}
              className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[conic-gradient(from_180deg,var(--cyan),var(--violet),var(--amber),var(--cyan))]"
            >
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-bg text-[11px] font-bold text-fg">{profile.shortName[0]}</span>
            </button>

            <button
              onClick={() => setOpen((o) => !o)}
              className="relative flex h-5 min-w-[118px] items-center overflow-hidden text-left"
              aria-label={`Current section: ${current.label}. Open menu`}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={current.id}
                  initial={{ y: 14, opacity: 0, filter: "blur(4px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: -14, opacity: 0, filter: "blur(4px)" }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="whitespace-nowrap"
                >
                  <span className="text-cyan">{String(idx).padStart(2, "0")}</span>
                  <span className="text-muted"> · </span>
                  <span className="text-fg">{current.label}</span>
                </motion.span>
              </AnimatePresence>
            </button>

            {/* scroll progress ring */}
            <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90 shrink-0" aria-hidden>
              <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
              <circle
                ref={ring}
                cx="10"
                cy="10"
                r="8"
                fill="none"
                stroke="url(#island-ring)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 8}
                strokeDashoffset={2 * Math.PI * 8}
              />
              <defs>
                <linearGradient id="island-ring">
                  <stop offset="0%" stopColor="#5eead4" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>

            <span className="h-4 w-px bg-line" aria-hidden />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? "copied" : active}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap"
              >
                {chip}
              </motion.span>
            </AnimatePresence>
          </motion.div>

          {/* ---------- expanded menu ---------- */}
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="menu"
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.08 } }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                className="w-[min(560px,calc(100vw-2rem))] px-2 pb-1 pt-2 md:pb-2 md:pt-0"
              >
                <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                  {SECTIONS.map((s, i) => (
                    <motion.li
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.025 }}
                      className="relative"
                    >
                      {active === s.id && (
                        <motion.span layoutId="island-active" className="absolute inset-0 rounded-xl bg-white/[0.07]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                      )}
                      <a
                        href={`#${s.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          go(s.id);
                        }}
                        aria-current={active === s.id ? "true" : undefined}
                        className="relative flex items-baseline gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="font-mono text-[10px] text-cyan">{String(i).padStart(2, "0")}</span>
                        <span className={active === s.id ? "text-fg" : "text-fg/75"}>{s.label}</span>
                      </a>
                    </motion.li>
                  ))}
                </ul>
                <div className="mt-1 flex items-center gap-2 border-t border-line px-1 pb-1 pt-2 md:pb-0">
                  <button
                    onClick={search}
                    className="flex flex-1 items-center gap-2 rounded-xl border border-line px-3 py-2 text-left text-sm text-muted transition-colors hover:border-cyan/50 hover:text-fg"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                    <span className="whitespace-nowrap sm:hidden">Search</span>
                    <span className="hidden whitespace-nowrap sm:inline">Jump to anything…</span>
                    {!touch && <kbd className="ml-auto rounded border border-line px-1.5 py-px font-mono text-[10px]">⌘K</kbd>}
                  </button>
                  <button onClick={copy} className="rounded-xl border border-line px-3 py-2 text-sm text-muted transition-colors hover:text-fg">
                    {copied ? "✓" : "Copy email"}
                  </button>
                  <a href={`mailto:${profile.email}`} className="rounded-xl bg-fg px-3 py-2 text-sm font-medium text-bg">
                    Hire me
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.nav>
      </div>
      <CommandPalette />
    </>
  );
}
