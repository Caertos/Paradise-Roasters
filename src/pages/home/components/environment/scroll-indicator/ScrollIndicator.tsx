import { useState, useEffect, useRef } from "react";

import "./scroll-indicator.css";

export default function ScrollIndicator() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (window.scrollY > 0) {
        setVisible(false);
      } else {
        timerRef.current = window.setTimeout(() => {
          setVisible(true);
        }, 5000);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    timerRef.current = window.setTimeout(() => {
      setVisible(true);
    }, 5000);

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={`scroll-indicator ${visible ? "scroll-indicator--visible" : ""}`}>
      <img src="/enviroment/arrowheaddown.svg" alt="" className="scroll-indicator__arrow" />
      <span className="scroll-indicator__text">keep scrolling</span>
    </div>
  );
}
