import "./user.css";

const dashboardCards = [
  {
    label: "Total Orders",
    value: "12",
    note: "Lifetime",
    iconClass: "user-dash-card__icon--orders",
  },
  {
    label: "Loyalty Points",
    value: "2,450",
    note: "+120 this month",
    iconClass: "user-dash-card__icon--points",
  },
  {
    label: "Favorite Product",
    value: "Paradise Blend",
    note: "Reorder →",
    iconClass: "user-dash-card__icon--favorite",
  },
];

const orders = [
  {
    id: "PR-1042",
    date: "July 5, 2026",
    status: "Delivered",
    total: "$54.50",
    item: "Paradise Blend 12oz",
  },
  {
    id: "PR-1039",
    date: "June 28, 2026",
    status: "Processing",
    total: "$22.00",
    item: "Single Origin: Ethiopia",
  },
  {
    id: "PR-1031",
    date: "June 14, 2026",
    status: "Shipped",
    total: "$36.50",
    item: "Colombian Supremo 2x",
  },
];

const settings = [
  { label: "Email Notifications", enabled: true },
  { label: "Dark Mode", enabled: false },
  { label: "Marketing Updates", enabled: true },
];

export default function User() {
  return (
    <div className="user page-bg">
      {/* ── Hero ── */}
      <section className="page-hero">
        <div className="container">
          <h1 className="page-hero__title">My Account</h1>
          <p className="page-hero__subtitle">
            Manage your profile, orders, and preferences in one place.
          </p>
        </div>
      </section>

      {/* ── Profile Card ── */}
      <section className="user-profile-section">
        <div className="container">
          <article className="user-profile">
            <div className="user-profile__avatar">
              <div className="image-placeholder image-placeholder--aspect-1-1 user-profile__avatar-img">
                <span className="image-placeholder__ratio">1:1</span>
                <span className="image-placeholder__hint">Avatar</span>
              </div>
            </div>
            <div className="user-profile__info">
              <h2 className="user-profile__name">Alex Thompson</h2>
              <p className="user-profile__email">alex.thompson@example.com</p>
              <p className="user-profile__meta">Member since March 2021</p>
            </div>
            <a href="#" className="user-profile__edit">
              Edit Profile
            </a>
          </article>
        </div>
      </section>

      {/* ── Dashboard cards ── */}
      <section className="user-dashboard">
        <div className="container">
          <div className="user-dashboard__grid">
            {dashboardCards.map((card, i) => (
              <article key={card.label} className="user-dash-card">
                <div
                  className={`user-dash-card__icon ${card.iconClass}`}
                  aria-hidden="true"
                />
                <p className="user-dash-card__label">{card.label}</p>
                <p className={`user-dash-card__value${i === 2 ? " user-dash-card__value--product" : ""}`}>{card.value}</p>
                <p className="user-dash-card__note">{card.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recent Orders ── */}
      <section className="user-orders">
        <div className="container">
          <h2 className="section-title">Recent Orders</h2>
          <div className="user-orders__list">
            {orders.map((order) => (
              <article key={order.id} className="user-order-row">
                <div className="user-order-row__thumb">
                  <div className="image-placeholder image-placeholder--aspect-1-1">
                    <span className="image-placeholder__ratio">1:1</span>
                    <span className="image-placeholder__hint">{order.item}</span>
                  </div>
                </div>
                <div className="user-order-row__main">
                  <span className="user-order-row__id">Order #{order.id}</span>
                  <span className="user-order-row__item">{order.item}</span>
                  <span className="user-order-row__date">{order.date}</span>
                </div>
                <div className="user-order-row__meta">
                  <span
                    className={`user-order-row__status user-order-row__status--${order.status.toLowerCase()}`}
                  >
                    {order.status}
                  </span>
                  <span className="user-order-row__total">{order.total}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Settings ── */}
      <section className="user-settings">
        <div className="container">
          <div className="user-settings__card">
            <h2 className="section-title">Preferences</h2>
            <ul className="user-settings__list">
              {settings.map((s) => (
                <li key={s.label} className="user-settings__row">
                  <span className="user-settings__label">{s.label}</span>
                  <button
                    type="button"
                    className={`toggle ${s.enabled ? "toggle--on" : ""}`}
                    aria-pressed={s.enabled}
                    aria-label={`Toggle ${s.label}`}
                  >
                    <span className="toggle__knob" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="user-settings__save">
              Save Preferences
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
