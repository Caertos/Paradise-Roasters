export type ProductAlign = "left" | "right";

/**
 * Front-end-only presentation of a product, keyed by slug. Everything else
 * (name, price, images, ...) comes from the catalog API.
 */
export interface ProductPresentation {
  decorativeImages: Decoration[];
  align: ProductAlign;
  /** Where the real bag photo sits in the art box; centred when absent. */
  bag?: Placement;
}

/** Position inside the 1086x958 home art box, in percent (height follows the image). */
export interface Placement {
  left: number;
  top: number;
  width: number;
}

/**
 * One decorative element (an animal, the coffee beans, a frame), kept as its
 * own image: `back` layers sit behind the bag, `front` layers in front of it.
 */
export interface Decoration extends Placement {
  src: string;
  layer: "back" | "front";
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
