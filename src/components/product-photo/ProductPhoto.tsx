import type { CSSProperties } from "react";
import type { ProductImage } from "@/lib/catalogApi";

interface ProductPhotoProps {
  image: ProductImage;
  /** The `sizes` attribute for the layout this photo sits in. */
  sizes: string;
  className?: string;
  loading?: "lazy" | "eager";
  style?: CSSProperties;
}

/**
 * A processed bag photo (transparent 4:5 WebP) with its 400/800/1600 px
 * derivatives. Explicit width/height reserve the 4:5 box before it loads.
 */
export default function ProductPhoto({
  image,
  sizes,
  className,
  loading = "lazy",
  style,
}: ProductPhotoProps) {
  const { sm, md, lg } = image.urls;
  return (
    <img
      src={md}
      srcSet={`${sm} 400w, ${md} 800w, ${lg} 1600w`}
      sizes={sizes}
      alt={image.alt}
      width={800}
      height={1000}
      loading={loading}
      decoding="async"
      className={className}
      style={style}
    />
  );
}
