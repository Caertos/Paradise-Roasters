import type { Product, ProductAlign, ProductPresentation } from "./types";

/**
 * Presentation config keyed by product slug: only the decorations and the
 * card alignment. Components merge it with the catalog API data.
 *
 * Conch and Turtle have no real product yet; their decorations
 * (`concha-decorative.png`, `turtle1.svg`, `turtle2.svg`) stay out of this map
 * pending the owner's decision (module 2, question 3). Keep the files.
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
 * Static placeholder products still rendered by the pages.
 *
 * @deprecated TODO(unit 5): remove once `/products` and home read from the
 * catalog API.
 */
export const products: Product[] = [
  {
    id: "flamingo",
    name: "The Caribbean",
    subtitle: "Flamingo",
    price: "$ 99.0",
    tagline: "Elegance and Balance",
    description:
      "Our national bird thrives in the delicate balance of our wetlands. These vibrant creatures remind us that even the smallest change in water quality can impact an entire ecosystem. When you explore our islands, practice Leave No Trace to ensure these horizons stay pink and wild.",
    image: "/products/Flamingo.png",
    decorativeImages: [
      "/products/flamingo1.svg",
      "/products/flamingo2-decorative.png",
    ],
    align: "left",
  },
  {
    id: "conch",
    name: "The Queen",
    subtitle: "Conch",
    price: "$ 99.0",
    tagline: "Resilience and Heritage",
    description:
      "The Conch is more than a shell; it is a symbol of Bahamian identity. As we enjoy its beauty, lets remember that healthy seagrass beds are vital for its survival. We invite you to choose sustainable local seafood and help keep our shallow waters pristine for generations to come.",
    image: "/products/Conch.png",
    decorativeImages: ["/products/concha-decorative.png"],
    align: "right",
  },
  {
    id: "turtle",
    name: "The Green Sea",
    subtitle: "Turtle",
    price: "$ 99.0",
    tagline: "Wisdom and Longevity",
    description:
      "Turtles have navigated our oceans for millions of years, but they now face modern threats like plastic and habitat loss. We invite you to reduce single-use plastics in your daily routine. Small shifts in how we live today can ensure these ancient travelers have a safe path home tomorrow.",
    image: "/products/Turtle.png",
    decorativeImages: ["/products/turtle1.svg", "/products/turtle2.svg"],
    align: "left",
  },
  {
    id: "grouper",
    name: "The Nassau",
    subtitle: "Grouper",
    price: "$ 99.0",
    tagline: "Community and Stability",
    description:
      "As a cornerstone of the reef, the Grouper keeps our underwater world in harmony. Protecting their spawning grounds is essential for a balanced ocean. We encourage everyone to learn about local fishing seasons, supporting the reefs natural cycles is the best way to ensure its future.",
    image: "/products/Grouper.png",
    decorativeImages: [
      "/products/grouper1.svg",
      "/products/grouper2.svg",
      "/products/grouper3.svg",
      "/products/grouper4.svg",
    ],
    align: "right",
  },
  {
    id: "marlin",
    name: "The Blue",
    subtitle: "Marlin",
    price: "$ 99.0",
    tagline: "Strength and Vitality",
    description:
      "The Marlin represents the untamed power of the open sea. A healthy ocean requires a healthy food chain, starting from the smallest plankton to the giants of the deep. By respecting our marine boundaries and keeping our beaches clean, we protect the vital pulse of the Atlantic.",
    image: "/products/Marlin.png",
    decorativeImages: ["/products/marlin-decorative.png"],
    align: "right",
  },
];
