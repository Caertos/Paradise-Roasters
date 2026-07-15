import Sun from "../sun/Sun";
import Cloud from "../cloud/Cloud";
import Flamingo from "../animal/Flamingo";
import Button from "@/components/button/Button";
import ScrollIndicator from "../scroll-indicator/ScrollIndicator";

import "./biome1.css";
import "../animal/flamingos.css";

export default function Biome1() {
  return (
    <section className="biome1">
      <div className="biome1__text">
        <p className="biome1__inspired">Inspired By</p>
        <h2 className="biome1__land">Land and Ocean</h2>
        <Button variant="join">Join</Button>
      </div>
      <Sun />
      <Cloud source="cloud1" />
      <Cloud source="cloud2" />
      <Cloud source="cloud3" />
      <Cloud source="cloud4" />
      <img src="/enviroment/mountains.svg" alt="" className="mountains" />
      <div className="flamingos group">
        <Flamingo source="flamingo" size="big" ext=".webp" />
        <Flamingo source="flamingo2" size="medium" ext=".webp" />
        <Flamingo source="flamingo" size="small" ext=".webp" />
        <Flamingo source="flamingo3" size="small" ext=".webp" />
        <Flamingo source="flamingo4" size="small" ext=".webp" />
      </div>
      <div className="flamingos-silhouette group">
        <Flamingo source="flamingo-silhouette" size="medium" ext=".svg" />
        <Flamingo source="flamingo-silhouette" size="small" ext=".svg" />
        <Flamingo source="flamingo-silhouette" size="x-small" ext=".svg" />
        <Flamingo source="flamingo-silhouette" size="x-small" ext=".svg" />
      </div>
      <ScrollIndicator />
    </section>
  );
}