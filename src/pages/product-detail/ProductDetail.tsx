import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useProduct,
  type Grind,
  type ImageSide,
  type ProductDetail as ProductDetailData,
} from "@/lib/catalogApi";
import ProductPhoto from "@/components/product-photo/ProductPhoto";
import StockBadge from "@/components/catalog-badges/StockBadge";
import RoastScale from "@/components/catalog-badges/RoastScale";
import AddToCartButton from "@/components/add-to-cart/AddToCartButton";
import "./product-detail.css";

const SITE_NAME = "Paradise Roasters";
const GRIND_LABEL: Record<Grind, string> = {
  ground: "Ground",
  whole_bean: "Whole bean",
};
const SIDE_LABEL: Record<ImageSide, string> = {
  front: "front",
  back: "back",
  detail: "detail",
};
const MAIN_SIZES = "(max-width: 768px) 100vw, 560px";

/** Sets the tab title while mounted and restores the previous one after. */
function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (title === null) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export default function ProductDetail() {
  const { slug } = useParams();
  const { data, status, error, reload } = useProduct(slug);

  let title: string | null = null;
  if (data) title = `${data.name} — ${SITE_NAME}`;
  else if (error?.status === 404) title = `Coffee not found — ${SITE_NAME}`;
  useDocumentTitle(title);

  return (
    <div className="product-detail page-bg">
      <div className="container product-detail__container">
        <Link to="/products" className="product-detail__back">
          ← All coffees
        </Link>

        {status === "loading" && (
          <div
            className="product-detail__layout"
            role="status"
            aria-label="Loading coffee"
          >
            <div className="image-placeholder product-detail__placeholder" />
            <div />
          </div>
        )}

        {status === "error" && error?.status === 404 && (
          <section className="product-detail__message">
            <h1 className="product-detail__message-title">Coffee not found</h1>
            <p>This coffee doesn't exist or is no longer available.</p>
            <Link to="/products" className="product-detail__message-button">
              Browse all coffees
            </Link>
          </section>
        )}

        {status === "error" && error?.status !== 404 && (
          <section className="product-detail__message" role="alert">
            <p>We couldn't load this coffee. Please try again.</p>
            <button
              type="button"
              className="product-detail__message-button"
              onClick={reload}
            >
              Try again
            </button>
          </section>
        )}

        {status === "success" && data && (
          // Keyed by slug so the gallery resets to the front per product.
          <ProductView key={data.slug} product={data} />
        )}
      </div>
    </div>
  );
}

function ProductView({ product }: { product: ProductDetailData }) {
  const images = product.images.length
    ? product.images
    : product.image
      ? [product.image]
      : [];
  const [selected, setSelected] = useState(0);
  const current = images[selected] ?? images[0];

  return (
    <article className="product-detail__layout">
      <div className="product-detail__gallery">
        {current ? (
          <ProductPhoto
            image={current}
            sizes={MAIN_SIZES}
            loading="eager"
            className="product-detail__photo"
          />
        ) : (
          <div className="image-placeholder product-detail__placeholder" />
        )}
        {images.length > 1 && (
          <div
            className="product-detail__thumbs"
            role="group"
            aria-label="Photos"
          >
            {images.map((image, i) => (
              <button
                key={image.urls.lg}
                type="button"
                className="product-detail__thumb"
                aria-pressed={i === selected}
                aria-label={`Show ${SIDE_LABEL[image.side]}`}
                onClick={() => setSelected(i)}
              >
                <img
                  src={image.urls.sm}
                  alt=""
                  width={80}
                  height={100}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="product-detail__info">
        <p className="product-detail__category">{product.category.name}</p>
        <h1 className="product-detail__name">{product.name}</h1>
        {product.subtitle && (
          <p className="product-detail__subtitle">{product.subtitle}</p>
        )}
        {product.tagline && (
          <p className="product-detail__tagline">{product.tagline}</p>
        )}

        <div className="product-detail__buy">
          <span className="product-detail__price">
            {product.price.formatted}
          </span>
          <StockBadge status={product.stock_status} />
        </div>
        <AddToCartButton
          product={product}
          className="product-detail__add-to-cart"
        />

        <dl className="product-detail__specs">
          <Spec label="Roast">
            <RoastScale level={product.roast_level} />
          </Spec>
          <Spec label="Grind">{GRIND_LABEL[product.grind]}</Spec>
          <Spec label="Weight">{`${product.weight_grams} g`}</Spec>
          {product.process && <Spec label="Process">{product.process}</Spec>}
          {product.varietal && <Spec label="Varietal">{product.varietal}</Spec>}
          {product.origin && <Spec label="Origin">{product.origin}</Spec>}
          {product.altitude_ft !== null && (
            <Spec label="Altitude">
              {`${product.altitude_ft.toLocaleString("en-US")} ft`}
            </Spec>
          )}
        </dl>

        <section className="product-detail__notes">
          <h2 className="product-detail__heading">Tasting notes</h2>
          {product.tasting_notes?.length ? (
            <ul className="product-detail__chips">
              {product.tasting_notes.map((note) => (
                <li key={note} className="product-detail__chip">
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            product.tasting_summary && (
              <p className="product-detail__summary">
                {product.tasting_summary}
              </p>
            )
          )}
        </section>

        <p className="product-detail__description">{product.description}</p>
      </div>
    </article>
  );
}

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="product-detail__spec">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
