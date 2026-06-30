import { useScroll } from "@/hooks/useScroll";

import Sun from "./sun/Sun";
import Cloud from "./cloud/Cloud";
import Animal from "./animal/Animal";

import "./environment.css";
import "./animal/flamingos.css";
import "./animal/fish.css";

export default function Environment() {
  useScroll();
  return (
    <div className="environment">
      <section className="biome1">
        <Sun />
        <Cloud source="cloud1" />
        <Cloud source="cloud2" />
        <Cloud source="cloud3" />
        <Cloud source="cloud4" />
        <img src="/mountains.svg" alt="" className="mountains" />
        <div className="flamingos group">
          <Animal
            type="flamingo"
            source="flamingo"
            size="big"
            ext=".webp"
            className="flamingo"
          />
          <Animal
            type="flamingo"
            source="flamingo2"
            size="medium"
            ext=".webp"
            className="flamingo"
          />
          <Animal
            type="flamingo"
            source="flamingo"
            size="small"
            ext=".webp"
            className="flamingo"
          />
          <Animal
            type="flamingo"
            source="flamingo3"
            size="small"
            ext=".webp"
            className="flamingo"
          />
          <Animal
            type="flamingo"
            source="flamingo4"
            size="small"
            ext=".webp"
            className="flamingo"
          />
        </div>
        <div className="flamingos-silhouette group">
          <Animal
            type="flamingo"
            source="flamingo-silhouette"
            size="medium"
            ext=".svg"
            className="flamingo"
          />
          <Animal
            type="flamingo"
            source="flamingo-silhouette"
            size="small"
            ext=".svg"
            className="flamingo"
          />
          <Animal
            type="flamingo"
            source="flamingo-silhouette"
            size="x-small"
            ext=".svg"
            className="flamingo"
          />
          <Animal
            type="flamingo"
            source="flamingo-silhouette"
            size="x-small"
            ext=".svg"
            className="flamingo"
          />
        </div>
      </section>
      <section className="biome2">
        <img src="/mountains.svg" alt="" className="mountains-reflected" />
        <img src="/water-light.webp" alt="" className="waterReflection" />
        <img src="/palm-trees.webp" alt="" className="palm-trees" />
        <img src="/island.webp" alt="" className="island" />
        <img src="/marine-shadows.webp" alt="" className="marine-shadow" />
      </section>
      <section className="biome3">
        <div className="butterflyfish group">
          <Animal type="fish" source="butterflyfish" size="big" ext=".svg" />
          <Animal type="fish" source="butterflyfish" size="small" ext=".svg" />
          <Animal type="fish" source="butterflyfish" size="x-small" ext=".svg" />
        </div>
        <div className="long-fish group">
          <Animal type="fish" source="longfish2" size="medium" ext=".svg" />
          <Animal type="fish" source="longfish3" size="small" ext=".svg" />
          <Animal type="fish" source="longfish1" size="big" ext=".svg" />
        </div>
      </section>
      <section className="biome4">
        <div className="lone-fish group">
          <Animal type="fish" source="fish" size="xx-big" ext=".svg" />
        </div>
      </section>
      <section className="biome5">
        <div className="school-fish group">
          <Animal type="fish" source="fish-school" size="big" ext=".svg" />
        </div>
      </section>
      <section className="biome6"></section>
      <img src="/corals.webp" alt="" className="corals" />
    </div>
  );
}
