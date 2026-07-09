import { useScroll } from "@/hooks/useScroll";
import Biome1 from "./biome/Biome1";
import Biome2 from "./biome/Biome2";
import Biome3 from "./biome/Biome3";
import Biome4 from "./biome/Biome4";
import Biome5 from "./biome/Biome5";
import Biome6 from "./biome/Biome6";

import "./environment.css";

export default function Environment() {
  useScroll();
  return (
    <div className="environment">
      <Biome1 />
      <Biome2 />
      <Biome3 />
      <Biome4 />
      <Biome5 />
      <Biome6 />
      <img src="/enviroment/corals.webp" alt="" className="corals" fetchPriority="high" />
    </div>
  );
}