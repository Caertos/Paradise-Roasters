import { useScroll } from "@/hooks/useScroll";

import Sun from "./sun/Sun";
import Cloud from "./cloud/Cloud";
import Flamingo from "./flamingo/Flamingo";

import "./enviroment.css";

export default function Enviroment() {
  useScroll();
  return (
    <section className="enviroment">
      <div className="enviroment1">
        <Sun />
        <Cloud source="nube1" />
        <Cloud source="nube2" />
        <Cloud source="nube3" />
        <Cloud source="nube4" />
        <img src="/mountains.svg" alt="Mountains" className="mountains" />
        <div className="flamingos">
          <Flamingo source="flamingo" size="big" ext=".webp" />
          <Flamingo source="flamingo" size="medium" ext=".webp" />
          <Flamingo source="flamingo" size="small" ext=".webp" />
          <Flamingo source="flamingo" size="small" ext=".webp" />
          <Flamingo source="flamingo" size="small" ext=".webp" />
        </div>
        <div className="flamingos-silhouette">
          <Flamingo source="flamingo-silhouette" size="medium" ext=".svg" />
          <Flamingo source="flamingo-silhouette" size="medium" ext=".svg"  />
          <Flamingo source="flamingo-silhouette" size="small" ext=".svg"  />
          <Flamingo source="flamingo-silhouette" size="small" ext=".svg" />
        </div>
      </div>
    </section>
  );
}
