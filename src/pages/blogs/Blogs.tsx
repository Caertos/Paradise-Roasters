import "./blogs.css";

const featured = {
  title: "A Beginner's Guide to the Perfect Pour Over",
  excerpt:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus lacinia odio vitae vestibulum vestibulum. Cras venenatis euismod malesuada. Nullam ac erat ante. Sed vehicula nisi quis nisi aliquam, nec tincidunt ligula consectetur. Donec fermentum felis nec libero bibendum. In our latest guide, we walk you through everything from grind size to water temperature, so you can brew a clean, expressive cup right at home — no fancy equipment required.",
  date: "July 8, 2026",
  aspect: "16:9",
};

const posts = [
  {
    title: "The Art of Pour Over",
    excerpt:
      "Master the slow, deliberate craft of pour-over coffee and unlock nuanced flavors.",
    date: "July 6, 2026",
  },
  {
    title: "Understanding Roast Levels",
    excerpt:
      "From light to dark, learn how roast profiles shape body, acidity, and aroma.",
    date: "July 1, 2026",
  },
  {
    title: "Cold Brew vs Iced Coffee",
    excerpt:
      "Two refreshing brews, two completely different processes. Which is right for you?",
    date: "June 24, 2026",
  },
  {
    title: "Sustainable Coffee Farming",
    excerpt:
      "How shade-grown and fair-trade practices protect ecosystems and farmer livelihoods.",
    date: "June 18, 2026",
  },
  {
    title: "Espresso at Home: A Guide",
    excerpt:
      "Dialing in your machine, dialing in your taste — pro tips for the home barista.",
    date: "June 11, 2026",
  },
  {
    title: "Coffee Origins: A World Tour",
    excerpt:
      "From Ethiopia to Guatemala, the terroir behind every cup tells a story.",
    date: "June 4, 2026",
  },
];

export default function Blogs() {
  return (
    <div className="blogs page-bg">
      {/* ── Hero ── */}
      <section className="page-hero">
        <div className="container">
          <h1 className="page-hero__title">Our Blog</h1>
          <p className="page-hero__subtitle">
            Stories from the roastery, brewing tips, and the people behind every
            cup we serve.
          </p>
        </div>
      </section>

      {/* ── Featured Post ── */}
      <section className="blogs-featured">
        <div className="container">
          <article className="featured-card">
            <div className="featured-card__media">
              <div className="image-placeholder">
                <span className="image-placeholder__ratio">
                  {featured.aspect}
                </span>
                <span className="image-placeholder__hint">Featured post</span>
              </div>
            </div>
            <div className="featured-card__body">
              <span className="featured-card__date">{featured.date}</span>
              <h2 className="featured-card__title">{featured.title}</h2>
              <p className="featured-card__excerpt">{featured.excerpt}</p>
              <a href="#" className="featured-card__link">
                Read More →
              </a>
            </div>
          </article>
        </div>
      </section>

      {/* ── Blog Grid ── */}
      <section className="blogs-grid-section">
        <div className="container">
          <h2 className="section-title section-title--center">More Stories</h2>
          <div className="blogs-grid">
            {posts.map((post) => (
              <article key={post.title} className="blog-card">
                <div className="image-placeholder">
                  <span className="image-placeholder__ratio">16:9</span>
                  <span className="image-placeholder__hint">{post.title}</span>
                </div>
                <div className="blog-card__body">
                  <span className="blog-card__date">{post.date}</span>
                  <h3 className="blog-card__title">{post.title}</h3>
                  <p className="blog-card__excerpt">{post.excerpt}</p>
                  <a href="#" className="blog-card__link">
                    Read More →
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Newsletter CTA ── */}
      <section className="blogs-cta">
        <div className="blogs-cta__inner container">
          <h2 className="blogs-cta__title">Never Miss a Post</h2>
          <p className="blogs-cta__text">
            Subscribe to our newsletter and get the latest stories, recipes, and
            roastery updates delivered to your inbox.
          </p>
          <form
            className="blogs-cta__form"
            onSubmit={(e) => e.preventDefault()}
            aria-label="Newsletter signup"
          >
            <input
              type="email"
              placeholder="your@email.com"
              className="blogs-cta__input"
              aria-label="Email address"
            />
            <button type="submit" className="blogs-cta__button">
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
