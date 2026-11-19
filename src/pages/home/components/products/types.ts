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
 * A home card for an animal whose coffee is not on sale yet (owner decision,
 * module 2 §0 question 3): no price, no product link, no add-to-cart.
 */
export interface ComingSoonItem {
  id: string;
  name: string;
  subtitle: string;
  tagline: string;
  description: string;
  image: string;
  align: ProductAlign;
}
