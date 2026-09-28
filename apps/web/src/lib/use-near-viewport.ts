"use client";

import * as React from "react";

/** True once the element has come within `margin` of the viewport; heavy things (a map) wait for it. */
export function useNearViewport(ref: React.RefObject<Element | null>, margin = "300px"): boolean {
  const [near, setNear] = React.useState(false);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setNear(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, margin]);
  return near;
}
