"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * The AISHA retrieval path as an animated pipeline:
 *  1. Distill  — filler words drop out, intent/time get extracted, the query is embedded
 *  2. Retrieve — vector search in an embedding space + BM25 keyword hits, side by side
 *  3. Fuse     — rows re-rank live by Reciprocal Rank Fusion, Σ 1/(60 + rank) (computed for real)
 *  4. Filter   — an LLM relevance scan prunes off-topic chunks, then a grounded answer streams with citations
 * Rankings and texts are illustrative.
 */

type Tok = { w: string; role: "keep" | "filler" | "time" };
type Doc = { id: string; title: string; snippet: string; vec?: number; bm25?: number; relevant: boolean };
type Query = {
  label: string;
  tokens: Tok[];
  distilled: string;
  intent: string;
  time: string;
  terms: string[];
  docs: Doc[];
  answer: string; // {id} marks a citation
};

const QUERIES: Query[] = [
  {
    label: "what's the refund rule if i cancel late??",
    tokens: [
      { w: "what's", role: "filler" },
      { w: "the", role: "filler" },
      { w: "refund", role: "keep" },
      { w: "rule", role: "keep" },
      { w: "if", role: "filler" },
      { w: "i", role: "filler" },
      { w: "cancel", role: "keep" },
      { w: "late??", role: "keep" },
    ],
    distilled: "refund policy for late cancellation",
    intent: "policy_lookup",
    time: "none",
    terms: ["refund", "late", "cancel"],
    docs: [
      { id: "d1", title: "Refund policy § 4.2 — late cancellations", snippet: "Late cancellations within 24h still qualify for a 50% refund.", vec: 2, bm25: 1, relevant: true },
      { id: "d2", title: "Cancellation windows by plan", snippet: "Each plan has a free cancel window before fees apply.", vec: 1, bm25: 4, relevant: true },
      { id: "d3", title: "How refunds are processed", snippet: "Approved refund payouts land in 5–7 business days.", vec: 3, bm25: 2, relevant: true },
      { id: "d4", title: "FAQ: changing your booking", snippet: "Dates can be changed up to 48h before the start.", vec: 4, relevant: false },
      { id: "d5", title: "Late fees schedule (2025)", snippet: "Late fees apply once a cancel window has closed.", bm25: 3, relevant: true },
      { id: "d6", title: "Customer satisfaction guarantee", snippet: "Unhappy? Contact support and we'll make it right.", vec: 5, relevant: false },
      { id: "d7", title: "Rule changes changelog", snippet: "v2.3 reworded the late cancel rule (no policy change).", bm25: 5, relevant: false },
    ],
    answer: "Cancelling late (within 24h) still gets you a 50% refund {d1}. Fees only start once your plan's free window closes {d2}{d5}, and approved refunds land in 5–7 business days {d3}.",
  },
  {
    label: "anything new about api limits last month",
    tokens: [
      { w: "anything", role: "filler" },
      { w: "new", role: "filler" },
      { w: "about", role: "filler" },
      { w: "api", role: "keep" },
      { w: "limits", role: "keep" },
      { w: "last", role: "time" },
      { w: "month", role: "time" },
    ],
    distilled: "API rate-limit changes",
    intent: "changelog",
    time: "last 30 days",
    terms: ["api", "limit", "429"],
    docs: [
      { id: "a1", title: "Changelog: rate limits raised to 1,500 RPM", snippet: "Oct 2026: default API limit raised from 600 to 1,500 RPM.", vec: 1, bm25: 1, relevant: true },
      { id: "a2", title: "Rate limiting & retries guide", snippet: "On a 429, back off exponentially and retry the API call.", vec: 2, bm25: 3, relevant: true },
      { id: "a3", title: "Quota dashboard walkthrough", snippet: "Track per-key usage against your monthly limit.", vec: 3, relevant: false },
      { id: "a4", title: "API limits FAQ (2023)", snippet: "Older plans had an API limit of 300 RPM per key.", bm25: 2, relevant: false },
      { id: "a5", title: "Concurrency gates explained", snippet: "Up to 200 concurrent API requests per workspace.", vec: 4, bm25: 5, relevant: true },
      { id: "a6", title: "Monthly product newsletter", snippet: "New themes, faster exports and a fresh onboarding flow.", vec: 5, relevant: false },
      { id: "a7", title: "Error code 429 reference", snippet: "429 means you exceeded the API rate limit for the key.", bm25: 4, relevant: true },
    ],
    answer: "Yes — last month the default limit was raised to 1,500 RPM {a1}, with up to 200 concurrent requests per workspace {a5}. If you hit a 429, back off and retry {a2}{a7}.",
  },
  {
    label: "how do i hook up stripe webhooks",
    tokens: [
      { w: "how", role: "filler" },
      { w: "do", role: "filler" },
      { w: "i", role: "filler" },
      { w: "hook", role: "keep" },
      { w: "up", role: "filler" },
      { w: "stripe", role: "keep" },
      { w: "webhooks", role: "keep" },
    ],
    distilled: "Stripe webhook integration setup",
    intent: "how_to",
    time: "none",
    terms: ["stripe", "webhook"],
    docs: [
      { id: "s1", title: "Stripe webhooks: step-by-step setup", snippet: "Add a webhook endpoint in the Stripe dashboard and pick events.", vec: 1, bm25: 1, relevant: true },
      { id: "s2", title: "Verifying webhook signatures", snippet: "Check the Stripe-Signature header with your endpoint secret.", vec: 3, bm25: 2, relevant: true },
      { id: "s3", title: "Payment events & credit top-ups", snippet: "checkout.session.completed adds credits to the account.", vec: 2, relevant: true },
      { id: "s4", title: "Hooks in the plugin SDK", snippet: "Plugins register lifecycle hooks on startup.", bm25: 3, relevant: false },
      { id: "s5", title: "Testing with the Stripe CLI", snippet: "stripe listen --forward-to localhost:8000/webhook", vec: 4, bm25: 4, relevant: true },
      { id: "s6", title: "Billing overview", snippet: "Plans, invoices and how credits are consumed.", vec: 5, relevant: false },
      { id: "s7", title: "Webhook retries & idempotency", snippet: "Stripe retries a failed webhook for 3 days — dedupe by event id.", bm25: 5, relevant: true },
    ],
    answer: "Create a webhook endpoint in the Stripe dashboard {s1}, verify the Stripe-Signature header {s2}, and test locally with stripe listen {s5}. Make handlers idempotent — Stripe retries for 3 days {s7}.",
  },
];

const K = 60;
const STEPS = ["Distill", "Retrieve", "Fuse (RRF)", "Filter + answer"];
const rrf = (d: Doc) => (d.vec ? 1 / (K + d.vec) : 0) + (d.bm25 ? 1 / (K + d.bm25) : 0);

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- Step 1: distill ---------------- */
function DistillView({ q, sub }: { q: Query; sub: number }) {
  const bars = useMemo(() => {
    const r = seeded(q.label.length * 97);
    return Array.from({ length: 48 }, () => r());
  }, [q]);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 text-center">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted">raw user query</p>
      <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 font-mono text-lg sm:text-2xl">
        {q.tokens.map((t, i) => {
          const gone = sub >= 1 && t.role !== "keep";
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={
                gone
                  ? t.role === "time"
                    ? { opacity: 0, y: 60, scale: 0.7, color: "#fbbf24" }
                    : { opacity: 0, y: 26, rotate: i % 2 ? 12 : -12, color: "#f87171" }
                  : { opacity: 1, y: 0, color: sub >= 1 ? "#5eead4" : "#e8eaf2" }
              }
              transition={{ delay: gone ? i * 0.05 : i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={gone ? "line-through" : ""}
            >
              {t.w}
            </motion.span>
          );
        })}
      </div>

      <AnimatePresence>
        {sub >= 2 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted">GPT-4o structured output</p>
            <p className="text-xl font-semibold sm:text-2xl">“{q.distilled}”</p>
            <div className="flex flex-wrap justify-center gap-2 font-mono text-xs">
              {[
                ["intent", q.intent, "#a78bfa"],
                ["time", q.time, "#fbbf24"],
              ].map(([k, v, c], i) => (
                <motion.span
                  key={k}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.25 + i * 0.15, type: "spring", stiffness: 400, damping: 18 }}
                  className="rounded-md px-2 py-1"
                  style={{ background: `${c}22`, color: c }}
                >
                  {k}: {v}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sub >= 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
            <div className="flex h-10 items-end gap-[3px]">
              {bars.map((h, i) => (
                <motion.span
                  key={i}
                  initial={{ height: 2 }}
                  animate={{ height: 4 + h * 36 }}
                  transition={{ delay: i * 0.012, type: "spring", stiffness: 300, damping: 14 }}
                  className="w-[3px] rounded-full"
                  style={{ background: `hsl(${170 + h * 90} 80% 65%)` }}
                />
              ))}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">gemini embedding · 3072-d</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Step 2: retrieve ---------------- */
function Highlighted({ text, terms, delay }: { text: string; terms: string[]; delay: number }) {
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(re);
  let n = 0;
  return (
    <>
      {parts.map((p, i) =>
        terms.some((t) => t.toLowerCase() === p.toLowerCase()) ? (
          <mark
            key={i}
            className="bm25-mark rounded-sm bg-transparent px-0.5 text-fg"
            style={{ animationDelay: `${delay + n++ * 0.18}s` }}
          >
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </>
  );
}

function RetrieveView({ q }: { q: Query }) {
  const W = 320;
  const H = 230;
  const Q = { x: W * 0.52, y: H * 0.5 };
  const { docs, noise } = useMemo(() => {
    const r = seeded(q.label.length * 131 + 7);
    const docs = q.docs.map((d) => {
      const a = r() * Math.PI * 2;
      const dist = d.vec ? 24 + d.vec * 15 : 92 + r() * 14;
      return { ...d, x: Q.x + Math.cos(a) * dist * 1.25, y: Q.y + Math.sin(a) * dist * 0.8 };
    });
    const noise = Array.from({ length: 46 }, () => {
      let x = 0;
      let y = 0;
      do {
        x = 10 + r() * (W - 20);
        y = 10 + r() * (H - 20);
      } while (Math.hypot((x - Q.x) / 1.25, (y - Q.y) / 0.8) < 105);
      return { x, y };
    });
    return { docs, noise };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const vecDocs = docs.filter((d) => d.vec).sort((a, b) => a.vec! - b.vec!);
  const ringR = 24 + 5 * 15 + 10;
  const bm = q.docs.filter((d) => d.bm25).sort((a, b) => a.bm25! - b.bm25!);

  return (
    <div className="grid h-full gap-4 md:grid-cols-2">
      {/* Vector space */}
      <div className="min-w-0 rounded-xl border border-line bg-white/[0.015] p-3">
        <p className="font-mono text-[11px] uppercase tracking-widest text-cyan">vector · Qdrant cosine top-5</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full">
          {noise.map((p, i) => (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={2}
              fill="#4b5270"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              transition={{ delay: i * 0.008 }}
            />
          ))}
          {/* search radius */}
          <motion.ellipse
            cx={Q.x}
            cy={Q.y}
            fill="rgba(94,234,212,0.05)"
            stroke="#5eead4"
            strokeOpacity={0.4}
            strokeDasharray="4 5"
            initial={{ rx: 0, ry: 0 }}
            animate={{ rx: ringR * 1.25, ry: ringR * 0.8 }}
            transition={{ delay: 0.55, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
          {/* neighbour links */}
          {vecDocs.map((d, i) => (
            <motion.line
              key={`l-${d.id}`}
              x1={Q.x}
              y1={Q.y}
              x2={d.x}
              y2={d.y}
              stroke="#5eead4"
              strokeWidth={1.3}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ delay: 1 + i * 0.18, duration: 0.4 }}
            />
          ))}
          {docs.map((d, i) => (
            <motion.g key={d.id} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 + i * 0.04 }} style={{ transformOrigin: `${d.x}px ${d.y}px`, transformBox: "view-box" }}>
              <circle cx={d.x} cy={d.y} r={d.vec ? 5 : 3.5} fill={d.vec ? "#5eead4" : "#fbbf24"} fillOpacity={d.vec ? 1 : 0.55} />
              {d.vec && (
                <motion.text
                  x={d.x + 8}
                  y={d.y + 3}
                  className="fill-fg font-mono text-[9px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1 + (d.vec - 1) * 0.18 }}
                >
                  #{d.vec} · {(0.93 - d.vec * 0.045).toFixed(2)}
                </motion.text>
              )}
            </motion.g>
          ))}
          {/* query star */}
          <motion.g initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 14 }} style={{ transformOrigin: `${Q.x}px ${Q.y}px`, transformBox: "view-box" }}>
            <circle cx={Q.x} cy={Q.y} r={11} fill="#5eead4" opacity={0.18}>
              <animate attributeName="r" values="9;15;9" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <path
              d={`M${Q.x},${Q.y - 8} L${Q.x + 2.4},${Q.y - 2.4} L${Q.x + 8},${Q.y} L${Q.x + 2.4},${Q.y + 2.4} L${Q.x},${Q.y + 8} L${Q.x - 2.4},${Q.y + 2.4} L${Q.x - 8},${Q.y} L${Q.x - 2.4},${Q.y - 2.4}Z`}
              fill="#fff"
            />
          </motion.g>
        </svg>
        <p className="font-mono text-[10px] text-muted">
          <span className="text-fg">✦ query</span> · <span className="text-cyan">● vector hit</span> · <span className="text-amber">● keyword-only</span>
        </p>
      </div>

      {/* BM25 */}
      <div className="min-w-0 rounded-xl border border-line bg-white/[0.015] p-3">
        <p className="font-mono text-[11px] uppercase tracking-widest text-amber">keyword · BM25 top-5</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {q.terms.map((t, i) => (
            <motion.span
              key={t}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="rounded bg-amber/15 px-1.5 py-0.5 font-mono text-[10px] text-amber"
            >
              {t}
            </motion.span>
          ))}
        </div>
        <ul className="mt-2 space-y-1.5">
          {bm.map((d, i) => {
            const score = 14.2 - (d.bm25! - 1) * 2.3;
            return (
              <motion.li
                key={d.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.14 }}
                className="rounded-lg border border-line bg-bg/60 px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted">{d.bm25}</span>
                  <span className="flex-1 truncate font-medium">{d.title}</span>
                  <span className="font-mono text-[10px] text-amber">{score.toFixed(1)}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted">
                  <Highlighted text={d.snippet} terms={q.terms} delay={0.6 + i * 0.14} />
                </p>
                <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full bg-amber"
                    initial={{ width: 0 }}
                    animate={{ width: `${(score / 14.2) * 100}%` }}
                    transition={{ delay: 0.6 + i * 0.14, duration: 0.6 }}
                  />
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Steps 3–4: fuse, filter, answer ---------------- */
function FuseView({ q, sub, typed, focusId, setFocusId }: { q: Query; sub: number; typed: number; focusId: string | null; setFocusId: (id: string | null) => void }) {
  // sub 0: rows arrive in vector order · 1: re-ranked by RRF · 2: scanning · 3: pruned · 4: answering
  const arrival = useMemo(() => [...q.docs].sort((a, b) => (a.vec ?? 9) - (b.vec ?? 9) || (a.bm25 ?? 9) - (b.bm25 ?? 9)), [q]);
  const fused = useMemo(() => [...q.docs].sort((a, b) => rrf(b) - rrf(a)), [q]);
  const order = sub >= 1 ? fused : arrival;
  const visible = sub >= 3 ? order.filter((d) => d.relevant) : order;
  const max = rrf(fused[0]);
  const kept = fused.filter((d) => d.relevant);
  const cite = (id: string) => kept.findIndex((d) => d.id === id) + 1;

  // Split the answer into text + citation pieces, then reveal `typed` characters
  const pieces = useMemo(() => q.answer.split(/(\{[a-z0-9]+\})/g).filter(Boolean), [q]);
  let budget = typed;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative">
        <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-widest">
          <span className="text-cyan">fused ranking · Σ 1/(60 + rank)</span>
          <span className="text-muted">{sub >= 3 ? `${visible.length} chunks → LLM context` : `${order.length} candidates`}</span>
        </div>
        <ul className="relative space-y-1.5">
          <AnimatePresence initial={false}>
            {visible.map((d, i) => {
              const s = rrf(d);
              const flagged = sub >= 2 && !d.relevant;
              const focused = focusId === d.id;
              return (
                <motion.li
                  key={d.id}
                  layout
                  initial={{ opacity: 0, x: d.vec ? -40 : 40 }}
                  animate={{
                    opacity: 1,
                    x: flagged ? [0, -6, 6, -4, 4, 0] : 0,
                    borderColor: focused ? "#5eead4" : flagged ? "rgba(248,113,113,0.6)" : "rgba(255,255,255,0.08)",
                  }}
                  exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.35 } }}
                  transition={{ layout: { type: "spring", stiffness: 300, damping: 30 }, delay: sub === 0 ? i * 0.08 : 0, x: { duration: 0.4, delay: flagged ? i * 0.12 : 0 } }}
                  onMouseEnter={() => setFocusId(d.id)}
                  onMouseLeave={() => setFocusId(null)}
                  className={`relative flex items-center gap-2 overflow-hidden rounded-lg border px-2.5 py-1.5 text-xs ${flagged ? "bg-red-500/[0.06]" : "bg-white/[0.025]"}`}
                >
                  <span className="w-4 font-mono text-muted">{i + 1}</span>
                  <span className={`flex-1 truncate ${flagged ? "text-red-300/80 line-through" : ""}`}>{d.title}</span>
                  <span className="hidden gap-1 font-mono text-[10px] sm:flex">
                    {d.vec && <span className="rounded bg-cyan/15 px-1 text-cyan">V#{d.vec}</span>}
                    {d.bm25 && <span className="rounded bg-amber/15 px-1 text-amber">B#{d.bm25}</span>}
                  </span>
                  <span className="relative h-1 w-14 overflow-hidden rounded-full bg-white/5 sm:w-20">
                    <motion.span
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan to-violet"
                      initial={{ width: 0 }}
                      animate={{ width: `${(s / max) * 100}%` }}
                      transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
                    />
                  </span>
                  <span className={`w-14 text-right font-mono text-[10px] ${flagged ? "text-red-400" : "text-cyan"}`}>
                    {flagged ? "pruned" : s.toFixed(4)}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {/* relevance scanner */}
          {sub === 2 && <span aria-hidden className="rag-scan pointer-events-none absolute inset-x-0 h-8 rounded-lg" />}
        </ul>
      </div>

      {/* Grounded answer */}
      <AnimatePresence>
        {sub >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-cyan/30 bg-cyan/[0.04] p-3.5"
          >
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-cyan">grounded answer</p>
            <p className="text-sm leading-relaxed text-fg/90">
              {pieces.map((p, i) => {
                if (budget <= 0) return null;
                const m = p.match(/^\{([a-z0-9]+)\}$/);
                if (m) {
                  budget -= 1;
                  const n = cite(m[1]);
                  return (
                    <motion.button
                      key={i}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      onMouseEnter={() => setFocusId(m[1])}
                      onMouseLeave={() => setFocusId(null)}
                      onFocus={() => setFocusId(m[1])}
                      onBlur={() => setFocusId(null)}
                      className="mx-0.5 inline-grid h-4 min-w-4 place-items-center rounded bg-cyan/20 px-1 align-text-top font-mono text-[10px] text-cyan hover:bg-cyan hover:text-bg"
                      aria-label={`Source ${n}`}
                    >
                      {n}
                    </motion.button>
                  );
                }
                const shown = p.slice(0, budget);
                budget -= p.length;
                return <span key={i}>{shown}</span>;
              })}
              {budget <= 0 && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-cyan align-middle" />}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Orchestrator ---------------- */
export default function RetrievalDemo() {
  const root = useRef<HTMLDivElement>(null);
  const [qi, setQi] = useState(0);
  const [step, setStep] = useState(-1);
  const [sub, setSub] = useState(0);
  const [typed, setTyped] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runId = useRef(0);
  const inView = useRef(false);
  const q = QUERIES[qi];

  const run = useCallback((index: number) => {
    const id = ++runId.current;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(() => id === runId.current && fn(), ms));
    setQi(index);
    setTyped(0);
    setFocusId(null);
    setStep(0);
    setSub(0);
    at(700, () => setSub(1));
    at(1400, () => setSub(2));
    at(1900, () => setSub(3));
    at(3000, () => setStep(1));
    at(6300, () => {
      setStep(2);
      setSub(0);
    });
    at(7600, () => setSub(1)); // re-rank
    at(8900, () => {
      setStep(3);
      setSub(2); // scan
    });
    at(10100, () => setSub(3)); // prune
    at(10700, () => {
      setSub(4); // answer
      const total = QUERIES[index].answer.replace(/\{[a-z0-9]+\}/g, "#").length;
      // One clock-based ticker (not a timer per character), so throttled tabs still finish on time
      const start = performance.now();
      const iv = setInterval(() => {
        if (id !== runId.current) return clearInterval(iv);
        const c = Math.min(total, Math.floor((performance.now() - start) / 22));
        setTyped(c);
        if (c >= total) {
          clearInterval(iv);
          // replay with the next question while still on screen
          at(6000, () => inView.current && run((index + 1) % QUERIES.length));
        }
      }, 30);
      timers.current.push(iv as unknown as ReturnType<typeof setTimeout>);
    });
  }, []);

  useEffect(() => {
    const el = root.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([e]) => {
        inView.current = e.isIntersecting;
        if (e.isIntersecting && runId.current === 0) {
          if (reduced) {
            runId.current = 1;
            setStep(3);
            setSub(4);
            setTyped(9999);
          } else run(0);
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    const t = timers;
    return () => {
      io.disconnect();
      t.current.forEach(clearTimeout);
    };
  }, [run]);

  return (
    <div ref={root}>
      <div className="flex flex-wrap items-center gap-2">
        {QUERIES.map((query, i) => (
          <button
            key={query.label}
            onClick={() => run(i)}
            className={`rounded-full border px-3 py-1.5 text-left font-mono text-xs transition-colors ${
              qi === i && step >= 0 ? "border-cyan bg-cyan/10 text-cyan" : "border-line text-muted hover:text-fg"
            }`}
          >
            “{query.label}”
          </button>
        ))}
      </div>

      {/* Stepper with a filling progress line */}
      <div className="relative mt-6">
        <div className="absolute left-0 right-0 top-[13px] h-px bg-line" />
        <motion.div
          className="absolute left-0 top-[13px] h-px bg-gradient-to-r from-cyan to-violet"
          animate={{ width: `${(Math.max(0, step) / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
        <ol className="relative flex justify-between">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-col items-center gap-1.5">
              <motion.span
                animate={{
                  backgroundColor: step >= i ? "#5eead4" : "#0d1018",
                  color: step >= i ? "#05060a" : "#8b90a5",
                  scale: step === i ? 1.15 : 1,
                }}
                className="grid h-7 w-7 place-items-center rounded-full border border-line font-mono text-[11px] font-bold"
              >
                {step > i ? "✓" : i + 1}
              </motion.span>
              {/* narrow screens: only the current step is labelled */}
              <span
                className={`whitespace-nowrap font-mono text-[10px] uppercase tracking-widest ${step >= i ? "text-fg" : "text-muted"} ${
                  step === i || (step < 0 && i === 0) ? "" : "hidden sm:inline"
                } ${i === 0 ? "self-start sm:self-auto" : i === STEPS.length - 1 ? "self-end sm:self-auto" : ""}`}
              >
                {s}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="relative mt-6 min-h-[620px] md:min-h-[400px]">
        <AnimatePresence mode="wait">
          {step < 0 ? (
            <motion.div key="idle" exit={{ opacity: 0 }} className="flex h-[400px] items-center justify-center rounded-2xl border border-dashed border-line">
              <button onClick={() => run(0)} className="rounded-full bg-cyan px-5 py-2.5 text-sm font-semibold text-bg">
                ▶ Run a query
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={`${qi}-${step === 3 ? 2 : step}`}
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
              transition={{ duration: 0.35 }}
              className="h-full"
            >
              {step === 0 && <DistillView q={q} sub={sub} />}
              {step === 1 && <RetrieveView q={q} />}
              {step >= 2 && <FuseView q={q} sub={sub} typed={typed} focusId={focusId} setFocusId={setFocusId} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
