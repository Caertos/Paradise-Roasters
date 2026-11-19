export type ProductAlign = "left" | "right";

/**
 * Front-end-only presentation of a product, keyed by slug. Everything else
 * (name, price, images, ...) comes from the catalog API.
 */
export interface ProductPresentation {
  decorativeImages: string[];
  align: ProductAlign;
}

/**
 * Shape of the static placeholder products.
 *
 * @deprecated TODO(unit 5): remove once the pages read from the catalog API.
 */
export interface Product {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  tagline: string;
  description: string;
  image: string;
  decorativeImages: string[];
  align: "left" | "right" | "center";
}
