import Enviroment from "./components/enviroment/Enviroment";

import "./home.css";

export default function Home() {
  return (
    <div className="home">
      <a className="home" href="/">
        <img src="/Logo.svg" alt="Logo" className="logo" />
      </a>
      <Enviroment />
    </div>
  );
}
