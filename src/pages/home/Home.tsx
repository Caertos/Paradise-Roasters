import Environment from "./components/environment/Environment";
import ProductCard from "./components/products/ProductCard";
import { products } from "./components/products/data";

import "./home.css";

export default function Home() {
  return (
    <div className="home">
      <a className="home" href="/">
        <img src="/Logo.svg" alt="Logo" className="logo" />
      </a>
      <Environment />
      <div className="products-overlay">
        <ProductCard product={products[0]} />
        <ProductCard product={products[1]} />
      </div>
    </div>
  );
}
