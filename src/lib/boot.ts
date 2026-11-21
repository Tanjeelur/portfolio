// Coordinates the terminal boot intro with the particle animation.
export const bootState = { done: false };

export function markBooted() {
  bootState.done = true;
  window.dispatchEvent(new Event("boot:done"));
}

/** Runs `fn` once the boot intro has finished (immediately if it already has). */
export function onBooted(fn: () => void) {
  if (bootState.done || document.documentElement.classList.contains("booted")) {
    fn();
    return () => {};
  }
  window.addEventListener("boot:done", fn, { once: true });
  return () => window.removeEventListener("boot:done", fn);
}
