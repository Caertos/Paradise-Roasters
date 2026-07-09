import { useEffect } from "react";

/**
 * Locks body scroll while `locked` is true.
 * Single responsibility: toggling document.body overflow. No rendering, no state.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [locked]);
}