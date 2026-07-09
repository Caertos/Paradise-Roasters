import Fish from "../animal/Fish";

import "./biome5.css";
import "../animal/fish.css";

export default function Biome5() {
  return (
    <section className="biome5">
      <div className="school-fish group">
        <Fish source="fish-school" size="big" />
      </div>
    </section>
  );
}