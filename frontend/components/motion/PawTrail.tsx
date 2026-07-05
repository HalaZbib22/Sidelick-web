"use client";

import { useEffect } from "react";

const PAW_SVG =
  '<svg viewBox="0 0 24 24" fill="#C2461A" width="18" height="18"><circle cx="6" cy="9" r="2.1"/><circle cx="10.4" cy="6" r="2.1"/><circle cx="13.6" cy="6" r="2.1"/><circle cx="18" cy="9" r="2.1"/><path d="M12 11c-2.6 0-4.8 2.2-4.8 4.4 0 1.7 1.4 2.6 3 2.6 1 0 1.2-.4 1.8-.4s.8.4 1.8.4c1.6 0 3-.9 3-2.6C16.8 13.2 14.6 11 12 11z"/></svg>';

/** Drops fading paw prints behind the cursor. Renders nothing; runs globally.
 *  Skips touch devices and respects reduce-motion. */
export function PawTrail() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let last = 0;
    const onMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - last < 60) return;
      last = now;
      const el = document.createElement("span");
      el.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:18px;height:18px;margin:-9px 0 0 -9px;pointer-events:none;z-index:9999;opacity:.45;transition:opacity .7s ease,transform .7s ease;`;
      el.innerHTML = PAW_SVG;
      document.body.appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = "0";
        el.style.transform = "scale(.5)";
      });
      setTimeout(() => el.remove(), 760);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return null;
}
