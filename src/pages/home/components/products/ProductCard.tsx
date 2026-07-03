import { useEffect, useRef, useState } from "react";
import type { Product } from "./types";
import Button from "@/components/button/Button";
import "./product-card.css";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`product-card product-card--${product.align} ${visible ? "product-card--visible" : ""}`}
    >
      <img
        src={product.image}
        alt={product.subtitle}
        className="product-card__image"
        loading="lazy"
      />
      <div className="product-card__info">
        <h2 className="product-card__title-line1">{product.name}</h2>
        <h3 className="product-card__title-line2">{product.subtitle}</h3>
        <p className="product-card__tagline">{product.tagline}</p>
        <div className="product__price-button">
          <span className="product-card__price">{product.price}</span>
          <Button>ORDER</Button>
        </div>
      </div>
    </div>
  );
}
