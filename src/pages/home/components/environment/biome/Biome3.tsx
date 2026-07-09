import Fish from "../animal/Fish";

import "./biome3.css";
import "../animal/fish.css";

export default function Biome3() {
  return (
    <section className="biome3">
      <div className="butterflyfish group">
        <Fish source="butterflyfish" size="big" />
        <Fish source="butterflyfish" size="small" />
        <Fish source="butterflyfish" size="x-small" />
      </div>
      <div className="long-fish group">
        <Fish source="longfish2" size="medium" />
        <Fish source="longfish3" size="small" />
        <Fish source="longfish1" size="big" />
      </div>
    </section>
  );
}