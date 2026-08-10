import "./cart.css";

const items = [
  {
    id: "paradise-blend",
    name: "Paradise Blend",
    unit: 18.0,
    qty: 2,
    aspect: "1:1",
  },
  {
    id: "colombian-supremo",
    name: "Colombian Supremo",
    unit: 16.5,
    qty: 1,
    aspect: "1:1",
  },
  {
    id: "espresso-roast",
    name: "Espresso Roast",
    unit: 20.0,
    qty: 1,
    aspect: "1:1",
  },
];

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

export default function Cart() {
  const subtotal = items.reduce((sum, i) => sum + i.unit * i.qty, 0);
  const shipping = 0; // free
  const total = subtotal + shipping;

  return (
    <div className="cart page-bg">
      {/* ── Hero ── */}
      <section className="page-hero">
        <div className="container">
          <h1 className="page-hero__title">Your Cart</h1>
          <p className="page-hero__subtitle">
            {items.length > 0
              ? `You have ${items.length} item${items.length === 1 ? "" : "s"} ready to roast.`
              : "Your cart is empty — let's fix that."}
          </p>
        </div>
      </section>

      {/* ── Cart layout: items + summary ── */}
      <section className="cart-section">
        <div className="container">
          <div className="cart-layout">
            {/* Items column */}
            <div className="cart-items">
              <h2 className="section-title">Items</h2>
              {/*
                NOTE: Empty state
                When `items.length === 0` we would render an empty-cart view here
                (icon, "Your cart is empty" message, and a CTA to /products).
                For this proof we always render the populated layout.
              */}
              <ul className="cart-items__list">
                {items.map((item) => (
                  <li key={item.id} className="cart-item">
                    <div className="cart-item__thumb">
                      <div className="image-placeholder image-placeholder--aspect-1-1">
                        <span className="image-placeholder__ratio">
                          {item.aspect}
                        </span>
                        <span className="image-placeholder__hint">
                          {item.name}
                        </span>
                      </div>
                    </div>
                    <div className="cart-item__main">
                      <h3 className="cart-item__name">{item.name}</h3>
                      <p className="cart-item__unit">{fmt(item.unit)} each</p>
                    </div>
                    <div className="cart-item__qty" aria-label="Quantity">
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="qty-value">{item.qty}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <div className="cart-item__subtotal">
                      {fmt(item.unit * item.qty)}
                    </div>
                    <button
                      type="button"
                      className="cart-item__remove"
                      aria-label={`Remove ${item.name}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Summary sidebar */}
            <aside className="cart-summary">
              <div className="cart-summary__card">
                <h2 className="cart-summary__title">Order Summary</h2>
                <div className="cart-summary__row">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="cart-summary__row">
                  <span>Shipping</span>
                  <span className="cart-summary__free">
                    Free
                    <small>orders over $30</small>
                  </span>
                </div>
                <div className="cart-summary__divider" />
                <div className="cart-summary__row cart-summary__row--total">
                  <span>Total</span>
                  <span>{fmt(total)}</span>
                </div>
                <button type="button" className="cart-summary__checkout">
                  Proceed to Checkout
                </button>
                <a href="/products" className="cart-summary__continue">
                  ← Continue Shopping
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
