import type { RoastLevel } from "@/lib/catalogApi";
import "./catalog-badges.css";

/** Filled beans out of four, as printed on the bags (Medium 2, Dark 4). */
const FILLED: Record<RoastLevel, number> = { light: 1, medium: 2, dark: 4 };
const LABEL: Record<RoastLevel, string> = {
  light: "Light",
  medium: "Medium",
  dark: "Dark",
};
const BEANS = [0, 1, 2, 3];

export default function RoastScale({ level }: { level: RoastLevel }) {
  const filled = FILLED[level];
  return (
    <span className="roast-scale">
      <span
        className="roast-scale__beans"
        role="img"
        aria-label={`Roast level: ${LABEL[level]}, ${filled} of 4`}
      >
        {BEANS.map((i) => (
          <svg
            key={i}
            viewBox="0 0 16 22"
            className={`roast-scale__bean ${i < filled ? "roast-scale__bean--filled" : ""}`}
            aria-hidden="true"
          >
            <ellipse cx="8" cy="11" rx="6.5" ry="9.5" />
            <path d="M8 2.5c-2.5 3-2.5 6 0 8.5s2.5 5.5 0 8.5" />
          </svg>
        ))}
      </span>
      <span className="roast-scale__label" aria-hidden="true">
        {LABEL[level]}
      </span>
    </span>
  );
}
