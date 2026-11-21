"use client";

import { useEffect, useState } from "react";
import { NAV_EVENTS } from "@/lib/nav";
import { AnimatePresence, motion } from "framer-motion";
import SectionHeading from "./SectionHeading";
import RetrievalDemo from "@/components/demos/RetrievalDemo";
import RateLimiterDemo from "@/components/demos/RateLimiterDemo";
import AgentsDemo from "@/components/demos/AgentsDemo";

const TABS = [
  {
    id: "rag",
    label: "Hybrid RAG",
    project: "AISHA",
    blurb: "How a messy question becomes grounded context: query distillation, two retrievers, Reciprocal Rank Fusion and an LLM relevance filter.",
    Demo: RetrievalDemo,
  },
  {
    id: "limiter",
    label: "Rate-limited fan-out",
    project: "GEO Intelligence",
    blurb: "The async pipeline that queries 6 LLM engines, through a traffic spike and a 429 storm: token bucket, concurrency gate and retries with backoff. Nothing gets dropped.",
    Demo: RateLimiterDemo,
  },
  {
    id: "agents",
    label: "Multi-agent crew",
    project: "GEO Intelligence",
    blurb: "The Analyze & Fix engine: three CrewAI agents hand work to each other, from diagnosis to publish-ready content.",
    Demo: AgentsDemo,
  },
];

export default function Demos() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  // Command palette → switch demo tab
  useEffect(() => {
    const onTab = (e: Event) => setActive((e as CustomEvent<number>).detail);
    window.addEventListener(NAV_EVENTS.demoTab, onTab);
    return () => window.removeEventListener(NAV_EVENTS.demoTab, onTab);
  }, []);

  return (
    <section id="demos" className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-40">
      <SectionHeading
        index="04"
        eyebrow="Under the hood"
        title={
          <>
            Don&apos;t take my word for it. <span className="text-gradient">Run it.</span>
          </>
        }
      />

      <div data-reveal className="glass rounded-3xl p-4 sm:p-8">
        <div role="tablist" aria-label="Interactive demos" className="flex gap-1 overflow-x-auto rounded-full bg-white/[0.03] p-1 [scrollbar-width:none]">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === i}
              aria-controls={`demo-${t.id}`}
              onClick={() => setActive(i)}
              className={`relative shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${
                active === i ? "text-bg" : "text-muted hover:text-fg"
              }`}
            >
              {active === i && (
                <motion.span layoutId="demo-tab" className="absolute inset-0 rounded-full bg-fg" transition={{ type: "spring", stiffness: 400, damping: 34 }} />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>

        <p className="mt-5 max-w-3xl text-sm text-muted">
          <span className="font-mono text-[11px] uppercase tracking-widest text-cyan">{tab.project}</span>
          <span className="mx-2 text-line">|</span>
          {tab.blurb}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab.id}
            id={`demo-${tab.id}`}
            role="tabpanel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mt-6"
          >
            <tab.Demo />
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
