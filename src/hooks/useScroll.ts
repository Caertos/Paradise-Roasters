import { useEffect, useRef } from "react";

export function useScroll() {
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const delta = Math.abs(scrollY - lastY.current);
      lastY.current = scrollY;

      const current = parseFloat(
        document.documentElement.style.getPropertyValue("--scroll-distance") ||
          "0",
      );

      document.documentElement.style.setProperty(
        "--scroll-distance",
        (current + delta).toString(),
      );
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
}
