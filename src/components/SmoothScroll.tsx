"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollState, SECTION_IDS } from "@/lib/scrollState";
import { setLenis } from "@/lib/nav";

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scrolling (Lenis) wired into GSAP's ticker, plus the global
 * scroll-reveal and counter animations driven by data attributes:
 *   data-reveal            fade/slide in when entering the viewport
 *   data-count="1500"      animate a number from 0 to the value
 */
export default function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const updateScroll = () => {
      scrollState.y = window.scrollY;
      scrollState.vh = window.innerHeight;
      // Active section = last one whose top has passed the middle of the viewport
      let current = "top";
      for (const s of sections) if (s.getBoundingClientRect().top <= window.innerHeight * 0.5) current = s.id;
      if (current !== scrollState.section) {
        scrollState.section = current;
        window.dispatchEvent(new CustomEvent("sectionchange", { detail: current }));
      }
    };
    updateScroll();

    let lenis: Lenis | null = null;
    const tick = (time: number) => lenis?.raf(time * 1000);

    if (!reduced) {
      // anchors: in-page #links glide instead of jumping
      lenis = new Lenis({ lerp: 0.09, anchors: { offset: -16, duration: 1.4 } });
      setLenis(lenis);
      lenis.on("scroll", () => {
        updateScroll();
        ScrollTrigger.update();
      });
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);

    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set("[data-reveal]", { opacity: 1 });
        document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
          el.textContent = Number(el.dataset.count).toLocaleString();
        });
        return;
      }

      // Reveal on enter — and also when a fast jump (nav link, Home/End) skips straight past,
      // so content can never be left hidden.
      const shown = new WeakSet<Element>();
      const reveal = (els: Element[]) => {
        const fresh = els.filter((e) => !shown.has(e));
        fresh.forEach((e) => shown.add(e));
        if (fresh.length)
          gsap.fromTo(
            fresh,
            { opacity: 0, y: 40, filter: "blur(8px)" },
            { opacity: 1, y: 0, filter: "blur(0px)", duration: 1, ease: "power3.out", stagger: 0.08 }
          );
      };
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 88%",
        onEnter: reveal,
        onLeave: reveal,
        onEnterBack: reveal,
      });

      // Headings: words slide up from behind a mask
      document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
        gsap.fromTo(
          el.querySelectorAll(".split-word > span"),
          // y: 0 clears the CSS pre-hide offset, which GSAP would otherwise read as a fixed px offset
          { y: 0, yPercent: 110, rotate: 4 },
          {
            y: 0,
            yPercent: 0,
            rotate: 0,
            duration: 1.1,
            ease: "power4.out",
            stagger: 0.06,
            scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play play play play" },
          }
        );
      });

      document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
        const target = Number(el.dataset.count);
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 2,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play play play play" },
          onUpdate: () => {
            el.textContent = Math.round(obj.v).toLocaleString();
          },
        });
      });

      // Timeline progress line in the experience section
      gsap.fromTo(
        "[data-timeline-line]",
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-timeline]",
            start: "top 70%",
            end: "bottom 60%",
            scrub: true,
          },
        }
      );
    });

    // Client-rendered parts (3D galaxy, demos) change the page height after mount:
    // recompute trigger positions whenever the document resizes.
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    ro.observe(document.body);

    return () => {
      ro.disconnect();
      clearTimeout(refreshTimer);
      ctx.revert();
      gsap.ticker.remove(tick);
      setLenis(null);
      lenis?.destroy();
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, []);

  return null;
}
