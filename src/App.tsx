import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Navbar from "./components/navbar/Navbar";
import ScrollToTop from "./components/scroll-to-top/ScrollToTop";
import LoadingScreen from "./components/loading/LoadingScreen";
import { useAllImagesLoaded } from "./hooks/useAllImagesLoaded";
import { useBodyScrollLock } from "./hooks/useBodyScrollLock";
import { setLoginRedirect } from "./lib/api";
import GuestRoute from "./auth/GuestRoute";
import ProtectedRoute from "./auth/ProtectedRoute";
import Home from "./pages/home/Home";
import About from "./pages/about/About";
import Products from "./pages/products/Products";
import Blogs from "./pages/blogs/Blogs";
import User from "./pages/user/User";
import Cart from "./pages/cart/Cart";
import Login from "./pages/login/Login";
import Register from "./pages/register/Register";
import ForgotPassword from "./pages/forgot-password/ForgotPassword";
import ResetPassword from "./pages/reset-password/ResetPassword";

function App() {
  const isLoaded = useAllImagesLoaded();
  useBodyScrollLock(!isLoaded);
  const navigate = useNavigate();

  // Send expired sessions to /login through the router instead of a reload.
  useEffect(() => {
    setLoginRedirect((url) => navigate(url, { replace: true }));
    return () => setLoginRedirect(null);
  }, [navigate]);

  return (
    <div className="App">
      {!isLoaded && <LoadingScreen />}
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/products" element={<Products />} />
        <Route path="/blogs" element={<Blogs />} />
        <Route
          path="/user"
          element={
            <ProtectedRoute>
              <User />
            </ProtectedRoute>
          }
        />
        <Route path="/cart" element={<Cart />} />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
      <ScrollToTop />
    </div>
  );
}

export default App;
