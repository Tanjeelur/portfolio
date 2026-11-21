"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { profile, projects, skills } from "@/data/resume";
import { emit, NAV_EVENTS, pauseScroll, resumeScroll, scrollToId, SECTIONS } from "@/lib/nav";

/**
 * ⌘K / Ctrl+K / "/" command palette: fuzzy-jump to sections, projects (opens the star in the galaxy),
 * skills (lights up the attention map), demos (switches the tab) and actions.
 */

type Group = "Sections" | "Projects" | "Demos" | "Skills" | "Actions";
type Item = { id: string; group: Group; label: string; hint: string; keywords?: string; run: () => void };

const ICON: Record<Group, string> = { Sections: "§", Projects: "◆", Demos: "▶", Skills: "#", Actions: "⚡" };
const COLOR: Record<Group, string> = {
  Sections: "#5eead4",
  Projects: "#a78bfa",
  Demos: "#4ade80",
  Skills: "#fbbf24",
  Actions: "#f472b6",
};
const TRIES = ["aisha", "qdrant", "fall detection", "copy email", "rate limit", "yolo"];

/** Subsequence fuzzy match → score (higher is better) and matched char indices, or null. */
function fuzzy(q: string, text: string): { score: number; hits: number[] } | null {
  if (!q) return { score: 0, hits: [] };
  const t = text.toLowerCase();
  const query = q.toLowerCase();
  const direct = t.indexOf(query);
  if (direct >= 0) {
    return { score: 100 - direct + (direct === 0 ? 50 : 0), hits: Array.from({ length: query.length }, (_, i) => direct + i) };
  }
  const hits: number[] = [];
  let ti = 0;
  let score = 0;
  for (const ch of query) {
    if (ch === " ") continue;
    const found = t.indexOf(ch, ti);
    if (found < 0) return null;
    score += hits.length && found === hits[hits.length - 1] + 1 ? 6 : 1;
    if (found === 0 || t[found - 1] === " ") score += 4;
    hits.push(found);
    ti = found + 1;
  }
  return { score, hits };
}

function Mark({ text, hits }: { text: string; hits: number[] }) {
  if (!hits.length) return <>{text}</>;
  const set = new Set(hits);
  return (
    <>
      {text.split("").map((c, i) =>
        set.has(i) ? (
          <span key={i} className="text-cyan">
            {c}
          </span>
        ) : (
          <span key={i}>{c}</span>
        )
      )}
    </>
  );
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [hint, setHint] = useState("");
  const [toast, setToast] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const lastFocus = useRef<Element | null>(null);

  const close = useCallback(() => setOpen(false), []);

  const items = useMemo<Item[]>(() => {
    const later = (id: string, fn: () => void, offset?: number) => () => {
      scrollToId(id, offset);
      setTimeout(fn, 1100);
    };
    return [
      ...SECTIONS.map((s, i) => ({
        id: `s:${s.id}`,
        group: "Sections" as const,
        label: s.label,
        hint: `section ${String(i).padStart(2, "0")}`,
        run: () => scrollToId(s.id),
      })),
      ...projects.map((p, i) => ({
        id: `p:${p.title}`,
        group: "Projects" as const,
        label: p.title,
        hint: p.kind,
        keywords: `${p.stack.join(" ")} ${p.cluster}`,
        // land on the galaxy itself (below the top island), then open the star
        run: later("galaxy", () => emit(NAV_EVENTS.selectProject, i), -84),
      })),
      ...["Hybrid RAG demo", "Rate limiter demo", "Multi-agent crew demo"].map((label, i) => ({
        id: `d:${i}`,
        group: "Demos" as const,
        label,
        hint: ["AISHA", "GEO", "GEO"][i],
        keywords: ["retrieval rrf bm25 vector", "rate limit token bucket 429", "crewai agents"][i],
        run: () => {
          scrollToId("demos");
          setTimeout(() => emit(NAV_EVENTS.demoTab, i), 300);
        },
      })),
      ...Object.entries(skills).flatMap(([group, list]) =>
        list.map((s) => ({
          id: `k:${s}`,
          group: "Skills" as const,
          label: s,
          hint: group,
          run: later("skills", () => emit(NAV_EVENTS.focusSkill, s)),
        }))
      ),
      {
        id: "a:copy",
        group: "Actions" as const,
        label: "Copy email",
        hint: profile.email,
        run: () => {
          navigator.clipboard?.writeText(profile.email).catch(() => {});
          setToast("Email copied ✓");
          setTimeout(() => setToast(""), 1600);
        },
      },
      { id: "a:mail", group: "Actions" as const, label: "Send an email", hint: "mailto", run: () => (window.location.href = `mailto:${profile.email}`) },
      { id: "a:gh", group: "Actions" as const, label: "Open GitHub", hint: "new tab", run: () => window.open(profile.links.github, "_blank", "noopener") },
      { id: "a:li", group: "Actions" as const, label: "Open LinkedIn", hint: "new tab", run: () => window.open(profile.links.linkedin, "_blank", "noopener") },
      { id: "a:gs", group: "Actions" as const, label: "Open Google Scholar", hint: "new tab", run: () => window.open(profile.links.scholar, "_blank", "noopener") },
      {
        id: "a:boot",
        group: "Actions" as const,
        label: "Replay intro",
        hint: "boot sequence",
        run: () => {
          try {
            sessionStorage.removeItem("booted");
          } catch {}
          window.scrollTo(0, 0);
          window.location.reload();
        },
      },
    ];
  }, []);

  const results = useMemo(() => {
    if (!q.trim()) {
      // Default view: sections, demos, projects, actions (skills appear when you type)
      return items.filter((it) => it.group !== "Skills").map((it) => ({ it, hits: [] as number[] }));
    }
    const scored = items
      .map((it) => {
        const m = fuzzy(q.trim(), it.label);
        const k = it.keywords ? fuzzy(q.trim(), it.keywords) : null;
        if (!m && !(k && k.score >= 40)) return null;
        return { it, hits: m?.hits ?? [], score: (m?.score ?? 0) + (k ? Math.min(k.score, 40) * 0.5 : 0) };
      })
      .filter(Boolean) as { it: Item; hits: number[]; score: number }[];
    return scored.sort((a, b) => b.score - a.score).slice(0, 12);
  }, [q, items]);

  // Open / close: keyboard shortcuts + event from the island
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, [contenteditable=true]");
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(NAV_EVENTS.openPalette, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(NAV_EVENTS.openPalette, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement;
      setQ("");
      setSel(0);
      pauseScroll();
      requestAnimationFrame(() => input.current?.focus());
    } else {
      resumeScroll();
      (lastFocus.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  // Typewriter placeholder: "Try “aisha”"
  useEffect(() => {
    if (!open || q) return;
    let i = 0;
    let c = 0;
    let dir = 1;
    const id = setInterval(() => {
      const word = TRIES[i % TRIES.length];
      c += dir;
      if (c > word.length + 8) dir = -1;
      if (c <= 0) {
        dir = 1;
        i++;
      }
      setHint(`Try “${word.slice(0, Math.max(0, Math.min(c, word.length)))}”`);
    }, 70);
    return () => clearInterval(id);
  }, [open, q]);

  useEffect(() => {
    setSel(0);
  }, [q]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const run = (it: Item) => {
    setOpen(false);
    // let the palette close before navigating
    setTimeout(it.run, 120);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(results.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[sel];
      if (r) run(r.it);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  let lastGroup: Group | null = null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="palette"
            data-lenis-prevent
            className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="absolute inset-0 bg-bg/60 backdrop-blur-sm" onClick={close} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              initial={{ opacity: 0, y: -14, scale: 0.97, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="relative w-full max-w-[600px] overflow-hidden rounded-2xl border border-line bg-[rgba(10,12,19,0.95)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
            >
              {/* animated gradient edge */}
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan to-transparent" />
              <div className="flex items-center gap-3 border-b border-line px-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-cyan" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={hint || "Jump to anything…"}
                  aria-label="Search sections, projects, skills and actions"
                  aria-controls="palette-list"
                  aria-activedescendant={results[sel] ? `pal-${results[sel].it.id}` : undefined}
                  className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted"
                />
                <kbd onClick={close} className="cursor-pointer rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">
                  esc
                </kbd>
              </div>

              <ul id="palette-list" ref={list} role="listbox" className="scroll-fade max-h-[min(52vh,440px)] overflow-y-auto p-2">
                {results.length === 0 && (
                  <li className="px-3 py-8 text-center font-mono text-xs text-muted">no matches — try “rag”, “yolo” or “email”</li>
                )}
                {results.map(({ it, hits }, i) => {
                  const header = it.group !== lastGroup;
                  lastGroup = it.group;
                  return (
                    <li key={it.id} role="presentation">
                      {header && (
                        <p className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-widest text-muted first:pt-1">{it.group}</p>
                      )}
                      <motion.button
                        id={`pal-${it.id}`}
                        role="option"
                        aria-selected={sel === i}
                        data-idx={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 10) * 0.018 }}
                        onMouseMove={() => sel !== i && setSel(i)}
                        onClick={() => run(it)}
                        className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                      >
                        {sel === i && (
                          <motion.span
                            layoutId="pal-active"
                            className="absolute inset-0 rounded-xl border border-cyan/25 bg-white/[0.06]"
                            transition={{ type: "spring", stiffness: 500, damping: 38 }}
                          />
                        )}
                        <span
                          className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-xs"
                          style={{ background: `${COLOR[it.group]}1a`, color: COLOR[it.group] }}
                        >
                          {ICON[it.group]}
                        </span>
                        <span className="relative flex-1 truncate text-sm text-fg/90">
                          <Mark text={it.label} hits={hits} />
                        </span>
                        <span className="relative hidden truncate font-mono text-[10px] text-muted sm:block">{it.hint}</span>
                        <span className={`relative font-mono text-[11px] text-cyan transition-opacity ${sel === i ? "opacity-100" : "opacity-0"}`}>↵</span>
                      </motion.button>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 font-mono text-[10px] text-muted">
                <span>
                  <kbd className="text-fg/70">↑↓</kbd> navigate
                </span>
                <span>
                  <kbd className="text-fg/70">↵</kbd> open
                </span>
                <span className="ml-auto hidden sm:inline">
                  <kbd className="text-fg/70">/</kbd> or <kbd className="text-fg/70">⌘K</kbd> anywhere
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[96] flex justify-center md:bottom-8" role="status">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="rounded-full border border-line bg-bg/90 px-4 py-2 font-mono text-xs text-[#4ade80] backdrop-blur"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
