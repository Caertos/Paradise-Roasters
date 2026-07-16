import { Routes, Route } from "react-router-dom";
import Navbar from "./components/navbar/Navbar";
import ScrollToTop from "./components/scroll-to-top/ScrollToTop";
import LoadingScreen from "./components/loading/LoadingScreen";
import { useAllImagesLoaded } from "./hooks/useAllImagesLoaded";
import { useBodyScrollLock } from "./hooks/useBodyScrollLock";
import Home from "./pages/home/Home";
import About from "./pages/about/About";
import Products from "./pages/products/Products";
import Blogs from "./pages/blogs/Blogs";
import User from "./pages/user/User";
import Cart from "./pages/cart/Cart";

function App() {
  const isLoaded = useAllImagesLoaded();
  useBodyScrollLock(!isLoaded);

  return (
    <div className="App">
      {!isLoaded && <LoadingScreen />}
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/products" element={<Products />} />
        <Route path="/blogs" element={<Blogs />} />
        <Route path="/user" element={<User />} />
        <Route path="/cart" element={<Cart />} />
      </Routes>
      <ScrollToTop />
    </div>
  );
}

export default App;
