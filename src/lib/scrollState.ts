// Tiny mutable store read inside render loops (no React re-renders).
export const scrollState = {
  /** Scroll offset in pixels */
  y: 0,
  /** Viewport height in pixels */
  vh: 1,
  /** id of the section currently in the middle of the viewport */
  section: "top",
  /** Free band (px from page top) above the hero copy where the particle name is placed */
  heroTop: 0,
  heroBottom: 0,
};

/** Section ids in page order (used by the nav and the particle palette). */
export const SECTION_IDS = ["top", "about", "experience", "projects", "demos", "research", "skills", "contact"];
