import { useEffect, useRef } from "react";

/**
 * Drives a parallax effect by accumulating scroll delta into a `--scroll-distance`
 * CSS custom property on <html>. The accumulator is intentionally unbounded:
 * consumers (`.group` in animal.css) wrap it with `mod()`, so the visual
 * movement cycles without resetting the source counter. Resetting this counter
 * would shift the parallax phase and is a behavioral change — keep it accumulating.
 *
 * Single responsibility: translate scroll position into a CSS variable.
 * No state is returned; the DOM mutation is the whole contract.
 */
export function useScroll(): void {
  const lastY = useRef<number>(0);

  useEffect(() => {
    const onScroll: EventListener = () => {
      const scrollY = window.scrollY;
      const delta = Math.abs(scrollY - lastY.current);
      lastY.current = scrollY;

      const root = document.documentElement;
      const current = parseFloat(
        root.style.getPropertyValue("--scroll-distance") || "0",
      );

      root.style.setProperty(
        "--scroll-distance",
        (current + delta).toString(),
      );
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}
