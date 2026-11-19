import { useRef } from "react";
import { Link } from "react-router-dom";
import type { Product } from "@/lib/catalogApi";
import type { ComingSoonItem, ProductPresentation } from "./types";
import { useInView } from "@/hooks/useInView";
import ProductPhoto from "@/components/product-photo/ProductPhoto";
import "./product-card.css";

const CARD_SIZES = "(max-width: 425px) 50vw, 30vw";

interface ProductCardProps {
  product: Product & ProductPresentation;
}

/** A featured catalog product on the home scene; links to its page. */
export default function ProductCard({ product }: ProductCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const href = `/products/${product.slug}`;

  return (
    <div
      ref={ref}
      data-card={product.slug}
      className={`product-card product-card--${product.align} ${visible ? "product-card--visible" : ""}`}
    >
      {product.image ? (
        <ProductPhoto
          image={product.image}
          sizes={CARD_SIZES}
          className="product-card__image"
        />
      ) : (
        <div className="product-card__image" aria-hidden="true" />
      )}
      <div className="product-card__info">
        <h2 className="product-card__title-line1">
          <Link to={href} className="product-card__link">
            {product.name}
          </Link>
        </h2>
        {product.subtitle && (
          <h3 className="product-card__title-line2">{product.subtitle}</h3>
        )}
        {product.tagline && (
          <p className="product-card__tagline">{product.tagline}</p>
        )}
        <div className="product__price-button">
          <span className="product-card__price">{product.price.formatted}</span>
          <Link to={href} className="button product-card__order">
            ORDER
          </Link>
        </div>
      </div>
    </div>
  );
}

/** An animal whose coffee is not on sale yet: no price, link or cart. */
export function ComingSoonCard({ item }: { item: ComingSoonItem }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);

  return (
    <div
      ref={ref}
      data-card={item.id}
      className={`product-card product-card--${item.align} product-card--soon ${visible ? "product-card--visible" : ""}`}
    >
      <img
        src={item.image}
        alt={`${item.subtitle} coffee bag, coming soon`}
        width={1086}
        height={958}
        className="product-card__image"
        loading="lazy"
        decoding="async"
      />
      <div className="product-card__info">
        <h2 className="product-card__title-line1">{item.name}</h2>
        <h3 className="product-card__title-line2">{item.subtitle}</h3>
        <p className="product-card__tagline">{item.tagline}</p>
        <span className="product-card__soon">Coming soon</span>
      </div>
    </div>
  );
}

/** Keeps a product slot's size while the featured products load. */
export function ProductCardPlaceholder() {
  return (
    <div
      data-card="placeholder"
      className="product-card product-card--placeholder"
      aria-hidden="true"
    >
      <div className="product-card__image" />
    </div>
  );
}
