import Fish from "../animal/Fish";

import "./biome4.css";
import "../animal/fish.css";

export default function Biome4() {
  return (
    <section className="biome4">
      <div className="tasteparadise">
        <div className="tasteparadise__text">
          <h2 className="tasteparadise__title">
            TASTE<br /><span className="tasteparadise__outline">PARADISE.</span>
          </h2>
          <p className="tasteparadise__subtitle">PRESERVE<br />NATURE.</p>
        </div>
      </div>
      <div className="lone-fish group">
        <Fish source="fish" size="xx-big" />
      </div>
    </section>
  );
}