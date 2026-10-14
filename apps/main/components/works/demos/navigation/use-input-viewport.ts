"use client";

import { useEffect, type RefObject } from "react";

/** Only a focused composer follows the keyboard viewport; ordinary browsing keeps its position. */
export function useInputViewport(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const focused = document.activeElement;
        const editing = focused instanceof HTMLTextAreaElement && element.contains(focused);
        const viewport = window.visualViewport;
        const height = editing && viewport ? viewport.height : window.innerHeight;
        element.style.setProperty("--input-viewport-height", `${height}px`);
        element.toggleAttribute("data-compact-input", height <= 600);
        if (editing && viewport) {
          const box = focused.getBoundingClientRect();
          const bottom = viewport.offsetTop + viewport.height - 12;
          if (box.bottom > bottom) window.scrollBy({ top: box.bottom - bottom, behavior: "instant" });
        }
      });
    };
    update();
    element.addEventListener("focusin", update);
    element.addEventListener("focusout", update);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("focusin", update);
      element.removeEventListener("focusout", update);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      element.style.removeProperty("--input-viewport-height");
      element.removeAttribute("data-compact-input");
    };
  }, [root]);
}
