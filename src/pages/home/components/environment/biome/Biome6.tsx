import Button from "@/components/button/Button";

import "./biome6.css";

export default function Biome6() {
  return (
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
          <Button variant="products">Products</Button>
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
  );
}