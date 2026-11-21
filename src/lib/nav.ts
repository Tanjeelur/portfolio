import type Lenis from "lenis";

// Shared navigation helpers for the island nav and the command palette.

let lenis: Lenis | null = null;
export const setLenis = (l: Lenis | null) => {
  lenis = l;
};

/** Smooth-scroll to a section id (Lenis when available, native otherwise). */
export function scrollToId(id: string, offset = -16) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(id === "top" ? 0 : el, { offset: id === "top" ? 0 : offset, duration: 1.4 });
  else el.scrollIntoView({ behavior: "smooth" });
}

/** Pause / resume smooth scrolling (e.g. while the command palette is open). */
export const pauseScroll = () => lenis?.stop();
export const resumeScroll = () => lenis?.start();

export const SECTIONS = [
  { id: "top", label: "Home" },
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "demos", label: "Demos" },
  { id: "research", label: "Research" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
];

/** Cross-component commands fired by the command palette. */
export const NAV_EVENTS = {
  openPalette: "palette:open",
  selectProject: "galaxy:select", // detail: project index
  focusSkill: "skills:focus", // detail: skill name
  demoTab: "demos:tab", // detail: tab index
} as const;

export function emit(name: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
