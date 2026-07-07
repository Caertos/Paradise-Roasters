import { useScroll } from "@/hooks/useScroll";

import Sun from "./sun/Sun";
import Cloud from "./cloud/Cloud";
import Animal from "./animal/Animal";
import Button from "@/components/button/Button";

import "./environment.css";
import "./animal/flamingos.css";
import "./animal/fish.css";

export default function Environment() {
  useScroll();
  return (
    <div className="environment">
      <section className="biome1">
        <div className="biome1__text">
          <p className="biome1__inspired">Inspired By</p>
          <h2 className="biome1__land">Land and Ocean</h2>
          <Button className="button--join">Join</Button>
        </div>
        <Sun />
        <Cloud source="cloud1" />
        <Cloud source="cloud2" />
        <Cloud source="cloud3" />
        <Cloud source="cloud4" />
        <img src="/enviroment/mountains.svg" alt="" className="mountains" />
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
        <img src="/enviroment/mountains.svg" alt="" className="mountains-reflected" loading="lazy" />
        <img src="/enviroment/water-light.webp" alt="" className="waterReflection" loading="lazy" />
        <img src="/enviroment/palm-trees.webp" alt="" className="palm-trees" loading="lazy" />
        <img src="/enviroment/island.webp" alt="" className="island" loading="lazy" />
        <img src="/enviroment/marine-shadows.webp" alt="" className="marine-shadow" loading="lazy" />
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
        <div className="tasteparadise">
          <div className="tasteparadise__text">
            <h2 className="tasteparadise__title">TASTE<br /><span className="tasteparadise__outline">PARADISE.</span></h2>
            <p className="tasteparadise__subtitle">PRESERVE<br />NATURE.</p>
          </div>
        </div>
        <div className="lone-fish group">
          <Animal type="fish" source="fish" size="xx-big" ext=".svg" />
        </div>
      </section>
      <section className="biome5">
        <div className="school-fish group">
          <Animal type="fish" source="fish-school" size="big" ext=".svg" />
        </div>
      </section>
      <section className="biome6">
        <div className="footer-container">
          <div className="footer-container__left">
            <h2 className="footer__title">The Origin<br />of Our<br />Inspiration</h2>
            <p className="footer__text">
              Inspired by the natural beauty of The Bahamas, we offer specialty coffee
              experiences that celebrate biodiversity, island culture, and conscious living.
              Every blend is crafted to connect people with nature while promoting
              appreciation for the ecosystems that make our islands unique.
            </p>
            <Button className="button--products">Products</Button>
          </div>
          <div className="footer-container__center">
            <img src="/footer-pic.png" alt="Paradise Roasters" className="footer-pic" />
          </div>
          <div className="footer-container__right">
            <img src="/Logo.svg" alt="Paradise Roasters" className="footer-logo" />
            <div className="footer-dots">
              {Array.from({ length: 32 }).map((_, i) => (
                <span key={i} className="footer-dots__dot"></span>
              ))}
            </div>
            <div className="footer-whatsapp">
              <img src="/whatsappico.svg" alt="WhatsApp" className="footer-whatsapp__icon" />
              <p className="footer-whatsapp__text">Contact us<br />on WhatsApp:</p>
              <a href="tel:5555555555" className="footer-whatsapp__phone">555 555 55 55</a>
            </div>
          </div>
        </div>
      </section>
      <img src="/enviroment/corals.webp" alt="" className="corals" fetchPriority="high" />
    </div>
  );
}
