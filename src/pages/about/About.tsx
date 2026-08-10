import "./about.css";

export default function About() {
  return (
    <div className="about">
      {/* ── Hero ── */}
      <section className="page-hero">
        <div className="container">
          <h1 className="page-hero__title">About Paradise Roasters</h1>
          <p className="page-hero__subtitle">
            Crafting exceptional coffee experiences since 2012 — from the
            world's finest farms to your morning cup.
          </p>
        </div>
      </section>

      {/* ── Our Story ── */}
      <section className="about-story">
        <div className="about-story__inner container">
          <div className="about-story__text">
            <h2 className="section-title">Our Story</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus
              lacinia odio vitae vestibulum vestibulum. Cras venenatis euismod
              malesuada. Nullam ac erat ante. Sed vehicula nisi quis nisi
              aliquam, nec tincidunt ligula consectetur. Donec fermentum felis
              nec libero bibendum, vitae scelerisque nunc faucibus.
            </p>
            <p>
              Pellentesque habitant morbi tristique senectus et netus et
              malesuada fames ac turpis egestas. Vestibulum tortor quam,
              feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu
              libero sit amet quam egestas semper. Aenean ultricies mi vitae
              est. Mauris placerat eleifend leo.
            </p>
          </div>
          <div className="about-story__media">
            <div className="image-placeholder">
              <span className="image-placeholder__ratio">16:9</span>
              <span className="image-placeholder__hint">Image placeholder — coffee farm panorama</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Our Values ── */}
      <section className="about-values">
        <div className="container">
          <h2 className="section-title section-title--center">Our Values</h2>
          <div className="about-values__grid">
            <article className="value-card">
              <div className="value-card__icon value-card__icon--leaf" aria-hidden="true" />
              <h3 className="value-card__title">Sustainability</h3>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                Vivamus lacinia odio vitae vestibulum. Cras venenatis euismod
                malesuada fermentum felis.
              </p>
            </article>

            <article className="value-card">
              <div className="value-card__icon value-card__icon--quality" aria-hidden="true" />
              <h3 className="value-card__title">Quality First</h3>
              <p>
                Nullam ac erat ante. Sed vehicula nisi quis nisi aliquam, nec
                tincidunt ligula consectetur. Donec fermentum felis nec libero
                bibendum.
              </p>
            </article>

            <article className="value-card">
              <div className="value-card__icon value-card__icon--community" aria-hidden="true" />
              <h3 className="value-card__title">Community</h3>
              <p>
                Pellentesque habitant morbi tristique senectus et netus et
                malesuada fames ac turpis egestas. Tortor quam feugiat vitae
                ultricies.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ── Our Process ── */}
      <section className="about-process">
        <div className="container">
          <h2 className="section-title section-title--center">
            From Farm to Your Cup
          </h2>

          <div className="process-step">
            <div className="process-step__media">
              <div className="image-placeholder image-placeholder--aspect-4-3">
                <span className="image-placeholder__ratio">4:3</span>
                <span className="image-placeholder__hint">Harvesting process</span>
              </div>
            </div>
            <div className="process-step__text">
              <span className="process-step__number">01</span>
              <h3>Sourced with Care</h3>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                Vivamus lacinia odio vitae vestibulum vestibulum. Cras
                venenatis euismod malesuada. Nullam ac erat ante. Sed vehicula
                nisi quis nisi aliquam.
              </p>
            </div>
          </div>

          <div className="process-step process-step--reverse">
            <div className="process-step__text">
              <span className="process-step__number">02</span>
              <h3>Roasted to Perfection</h3>
              <p>
                Pellentesque habitant morbi tristique senectus et netus et
                malesuada fames ac turpis egestas. Vestibulum tortor quam,
                feugiat vitae, ultricies eget, tempor sit amet, ante.
              </p>
            </div>
            <div className="process-step__media">
              <div className="image-placeholder image-placeholder--aspect-1-1">
                <span className="image-placeholder__ratio">1:1</span>
                <span className="image-placeholder__hint">Roasting beans</span>
              </div>
            </div>
          </div>

          <div className="process-step">
            <div className="process-step__media">
              <div className="image-placeholder image-placeholder--aspect-4-3">
                <span className="image-placeholder__ratio">4:3</span>
                <span className="image-placeholder__hint">Packaging station</span>
              </div>
            </div>
            <div className="process-step__text">
              <span className="process-step__number">03</span>
              <h3>Delivered Fresh</h3>
              <p>
                Donec eu libero sit amet quam egestas semper. Aenean ultricies
                mi vitae est. Mauris placerat eleifend leo. Quisque sit amet
                est et sapien ullamcorper pharetra.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="about-team">
        <div className="container">
          <h2 className="section-title section-title--center">Meet the Team</h2>
          <p className="about-team__intro">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus
            lacinia odio vitae vestibulum vestibulum.
          </p>
          <div className="about-team__grid">
            {[
              { name: "Marco Rivera", role: "Founder & Head Roaster", aspect: "3:4" },
              { name: "Elena Vásquez", role: "Green Coffee Buyer", aspect: "3:4" },
              { name: "Daniel Park", role: "Quality Control Lead", aspect: "3:4" },
              { name: "Sofia Mendez", role: "Operations Manager", aspect: "3:4" },
            ].map((member) => (
              <div key={member.name} className="team-card">
                <div className="image-placeholder image-placeholder--aspect-3-4">
                  <span className="image-placeholder__ratio">{member.aspect}</span>
                  <span className="image-placeholder__hint">{member.name}</span>
                </div>
                <h3 className="team-card__name">{member.name}</h3>
                <p className="team-card__role">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="about-cta">
        <div className="about-cta__inner container">
          <h2 className="about-cta__title">Want to Know More?</h2>
          <p className="about-cta__text">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus
            lacinia odio vitae vestibulum.
          </p>
          <a href="/products" className="about-cta__button">
            Explore Our Products
          </a>
        </div>
      </section>
    </div>
  );
}
