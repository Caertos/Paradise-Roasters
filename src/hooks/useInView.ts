import { useEffect, useState, type RefObject } from "react";

/**
 * Observes whether an element is intersecting the viewport.
 * Single responsibility: viewport detection only. No rendering, no DOM mutation.
 */
export function useInView(
  ref: RefObject<Element | null>,
  threshold: number = 0.2,
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return inView;
}