import { useEffect } from "react";
import Navbar from "./components/navbar/Navbar";
import LoadingScreen from "./components/loading/LoadingScreen";
import { useAllImagesLoaded } from "./hooks/useAllImagesLoaded";
import "./App.css";
import Home from "./pages/home/Home";

function App() {
  const isLoaded = useAllImagesLoaded();

  useEffect(() => {
    if (!isLoaded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isLoaded]);

  return (
    <div className="App">
      {!isLoaded && <LoadingScreen />}
      <Navbar />
      <Home />
    </div>
  );
}

export default App;
