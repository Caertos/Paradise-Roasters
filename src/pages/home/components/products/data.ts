import type {
  ComingSoonItem,
  ProductAlign,
  ProductPresentation,
} from "./types";

/**
 * Presentation config keyed by product slug: only the decorations and the
 * card alignment. Components merge it with the catalog API data.
 *
 * Conch and Turtle have no real product yet; they render on home as
 * "Coming soon" cards (`comingSoon` below), not through this map.
 */
export const productPresentation: Readonly<
  Record<string, ProductPresentation>
> = {
  blend: {
    decorativeImages: ["/products/marlin-decorative.png"],
    align: "right",
  },
  "pink-bourbon": {
    decorativeImages: [
      "/products/grouper1.svg",
      "/products/grouper2.svg",
      "/products/grouper3.svg",
      "/products/grouper4.svg",
    ],
    align: "right",
  },
  castillo: {
    decorativeImages: [
      "/products/flamingo1.svg",
      "/products/flamingo2-decorative.png",
    ],
    align: "left",
  },
};

/** Used for any product without an entry in the map. */
export const DEFAULT_PRESENTATION: Readonly<{
  decorativeImages: readonly string[];
  align: ProductAlign;
}> = Object.freeze({ decorativeImages: Object.freeze([]), align: "left" });

/** The presentation for a slug, or a fresh copy of the defaults. */
export function getPresentation(slug: string): ProductPresentation {
  if (Object.hasOwn(productPresentation, slug)) {
    return productPresentation[slug];
  }
  return {
    decorativeImages: [...DEFAULT_PRESENTATION.decorativeImages],
    align: DEFAULT_PRESENTATION.align,
  };
}

/** Returns the API product plus its presentation (defaults when unmapped). */
export function mergePresentation<T extends { slug: string }>(
  product: T,
): T & ProductPresentation {
  const { decorativeImages, align } = getPresentation(product.slug);
  return { ...product, decorativeImages: [...decorativeImages], align };
}

/**
 * Animals without a coffee on sale yet. Home shows them as "Coming soon"
 * cards; they are not products and never appear on /products.
 */
export const comingSoon: readonly ComingSoonItem[] = [
  {
    id: "conch",
    name: "The Queen",
    subtitle: "Conch",
    tagline: "Resilience and Heritage",
    description:
      "The Conch is more than a shell; it is a symbol of Bahamian identity. As we enjoy its beauty, lets remember that healthy seagrass beds are vital for its survival. We invite you to choose sustainable local seafood and help keep our shallow waters pristine for generations to come.",
    image: "/products/Conch.png",
    align: "right",
  },
  {
    id: "turtle",
    name: "The Green Sea",
    subtitle: "Turtle",
    tagline: "Wisdom and Longevity",
    description:
      "Turtles have navigated our oceans for millions of years, but they now face modern threats like plastic and habitat loss. We invite you to reduce single-use plastics in your daily routine. Small shifts in how we live today can ensure these ancient travelers have a safe path home tomorrow.",
    image: "/products/Turtle.png",
    align: "left",
  },
];
