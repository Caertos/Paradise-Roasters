import Environment from "./components/environment/Environment";
import HomeProducts from "./components/products/HomeProducts";

import "./home.css";

export default function Home() {
  return (
    <div className="home">
      <a className="home" href="/">
        <img src="/Logo.svg" alt="Logo" className="logo" />
      </a>
      <Environment />
      <HomeProducts />
    </div>
  );
}
