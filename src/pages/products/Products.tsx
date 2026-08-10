import "./products.css";
import { products } from "../home/components/products/data";

export default function Products() {
  return (
    <div className="products page-bg">
      {/* ── Hero ── */}
      <section className="page-hero">
        <div className="container">
          <h1 className="page-hero__title">Our Products</h1>
          <p className="page-hero__subtitle">
            Small-batch roasted coffee, sourced from the world's finest farms
            and shipped fresh to your door.
          </p>
        </div>
      </section>

      {/* ── Product Grid ── */}
      <section className="products-grid-section">
        <div className="container">
          <h2 className="section-title section-title--center">
            Explore the Collection
          </h2>
          <div className="products-grid">
            {products.map((p) => (
              <article key={p.id} className="pr-card">
                <div className="image-placeholder image-placeholder--aspect-4-3">
                  <span className="image-placeholder__ratio">4:3</span>
                  <span className="image-placeholder__hint">{p.name} — {p.subtitle}</span>
                </div>
                <h3 className="pr-card__name">
                  {p.name}
                  <span className="pr-card__subtitle"> — {p.subtitle}</span>
                </h3>
                <span className="pr-card__tagline">{p.tagline}</span>
                <p className="pr-card__desc">{p.description}</p>
                <div className="pr-card__footer">
                  <span className="pr-card__price">{p.price}</span>
                  <button type="button" className="pr-card__button">
                    Add to Cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="products-cta">
        <div className="products-cta__inner container">
          <h2 className="products-cta__title">Can't Decide?</h2>
          <p className="products-cta__text">
            Get to know us better — read the story behind our roasts and the
            farms we partner with.
          </p>
          <a href="/about" className="products-cta__button">
            Visit Our Story
          </a>
        </div>
      </section>
    </div>
  );
}
