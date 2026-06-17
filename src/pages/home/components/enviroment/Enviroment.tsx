import { useScroll } from "@/hooks/useScroll";

import Sun from "./sun/Sun";
import Cloud from "./cloud/Cloud";
import Animal from "./animal/Animal";

import "./enviroment.css";
import "./animal/flamingos.css";

export default function Enviroment() {
  useScroll();
  return (
    <div className="enviroment">
      <section className="bioma1">
        <Sun />
        <Cloud source="nube1" />
        <Cloud source="nube2" />
        <Cloud source="nube3" />
        <Cloud source="nube4" />
        <img src="/mountains.svg" alt="" className="mountains" />
        <div className="flamingos">
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
        <div className="flamingos-silhouette">
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
      <section className="bioma2">
        <img src="/mountains.svg" alt="" className="mountains-reflected" />
        <img src="/luzagua.webp" alt="" className="waterReflection" />
        <img src="/palmeras.webp" alt="" className="palm-trees" />
        <img src="/isla.webp" alt="" className="island" />
        <img src="/sombrasmarinas.webp" alt="" className="marine-shadow" />
      </section>
      <section className="bioma3">
        <Animal type="pez" source="pez" size="big" ext=".webp" />
      </section>
      <section className="bioma4"></section>
      <section className="bioma4"></section>
      <section className="bioma4"></section>
    </div>
  );
}
