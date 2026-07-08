import { useState, useEffect } from "react";

export function useAllImagesLoaded(): boolean {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>("img:not([loading='lazy'])")
    );

    if (images.length === 0) return;

    const pendingImages = new Set<HTMLImageElement>();
    const cleanupMap = new Map<
      HTMLImageElement,
      { onLoad: EventListener; onError: EventListener }
    >();

    const checkAllLoaded = () => {
      if (pendingImages.size === 0) {
        setIsLoaded(true);
      }
    };

    images.forEach((img) => {
      if (img.complete) {
        return;
      }

      pendingImages.add(img);

      const onLoad: EventListener = () => {
        pendingImages.delete(img);
        checkAllLoaded();
      };
      const onError: EventListener = () => {
        pendingImages.delete(img);
        checkAllLoaded();
      };

      cleanupMap.set(img, { onLoad, onError });
      img.addEventListener("load", onLoad);
      img.addEventListener("error", onError);
    });

    checkAllLoaded();

    return () => {
      cleanupMap.forEach((handlers, img) => {
        img.removeEventListener("load", handlers.onLoad);
        img.removeEventListener("error", handlers.onError);
      });
    };
  }, []);

  return isLoaded;
}
