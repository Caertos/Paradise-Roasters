import ProductCard from "./ProductCard";
import { products } from "./data";
import "./product-showcase.css";

export default function ProductShowcase() {
  return (
    <div className="product-showcase">
      <h2 className="product-showcase__title">PRODUCTS</h2>
      <div className="product-showcase__grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
