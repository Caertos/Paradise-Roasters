import Navbar from "./components/navbar/Navbar";
import LoadingScreen from "./components/loading/LoadingScreen";
import { useAllImagesLoaded } from "./hooks/useAllImagesLoaded";
import { useBodyScrollLock } from "./hooks/useBodyScrollLock";
import Home from "./pages/home/Home";

function App() {
  const isLoaded = useAllImagesLoaded();
  useBodyScrollLock(!isLoaded);

  return (
    <div className="App">
      {!isLoaded && <LoadingScreen />}
      <Navbar />
      <Home />
    </div>
  );
}

export default App;
