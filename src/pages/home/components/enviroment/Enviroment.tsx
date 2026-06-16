import { useScroll } from "@/hooks/useScroll";

import Sun from "./sun/Sun";
import Cloud from "./cloud/Cloud";
import Flamingo from "./flamingo/Flamingo";

import "./enviroment.css";

export default function Enviroment() {
  useScroll();
  return (
    <div className="enviroment">
      <section className="enviroment1">
        <Sun />
        <Cloud source="nube1" />
        <Cloud source="nube2" />
        <Cloud source="nube3" />
        <Cloud source="nube4" />
        <img src="/mountains.svg" alt="Mountains" className="mountains" />
        <div className="flamingos">
          <Flamingo source="flamingo" size="big" ext=".webp" />
          <Flamingo source="flamingo2" size="medium" ext=".webp" />
          <Flamingo source="flamingo" size="small" ext=".webp" />
          <Flamingo source="flamingo3" size="small" ext=".webp" />
          <Flamingo source="flamingo4" size="small" ext=".webp" />
        </div>
  <div className="flamingos-silhouette">
          <Flamingo source="flamingo-silhouette" size="medium" ext=".svg" />
         <Flamingo source="flamingo-silhouette" size="small" ext=".svg"  />
          <Flamingo source="flamingo-silhouette" size="x-small" ext=".svg"  />
          <Flamingo source="flamingo-silhouette" size="x-small" ext=".svg" />
        </div>
      </section>
      <section className="enviroment2">
        <img src="/mountains.svg" alt="Mountains" className="mountains-reflected"/>
        <img src="/luzagua.webp" className="waterReflection"/>
        <img src="/palmeras.webp" className="palm-trees"/>
        <img src="/isla.webp" className="island"/>
        <img src="/sombrasmarinas.webp" className="marine-shadow"/>
      </section>
    <section className="enviroment3">
    </section>
    <section className="enviroment4">
    </section>
        <section className="enviroment4">
    </section>    <section className="enviroment4">
    </section>
    </div>
  );
}
