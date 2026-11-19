import type {
  ComingSoonItem,
  Decoration,
  ProductAlign,
  ProductPresentation,
} from "./types";

/** A decoration from `public/products/decor/` placed in the home art box. */
function deco(
  name: string,
  layer: Decoration["layer"],
  left: number,
  top: number,
  width: number,
): Decoration {
  return { src: `/products/decor/${name}.webp`, layer, left, top, width };
}

/**
 * Presentation config keyed by product slug: the decorations around the bag,
 * where the bag sits, and the card alignment. Components merge it with the
 * catalog API data. Each decoration (animal, beans, frame) is a separate
 * image, so the real bag photo can change without touching the artwork.
 *
 * Conch and Turtle have no real product yet; they render on home as
 * "Coming soon" cards (`comingSoon` below), not through this map.
 */
export const productPresentation: Readonly<
  Record<string, ProductPresentation>
> = {
  castillo: {
    decorativeImages: [
      deco("frame-a", "back", 24, 17, 48),
      deco("frame-c", "back", 29, 22, 40),
      deco("beans", "back", 63, 3, 18),
      deco("flamingo", "front", 7, 34, 27),
    ],
    align: "left",
    bag: { left: 24, top: 14, width: 50 },
  },
  "pink-bourbon": {
    decorativeImages: [
      deco("frame-b", "back", 45, 26, 44),
      deco("frame-a", "back", 49, 31, 40),
      deco("beans", "back", 74, 8, 17),
      deco("grouper", "back", 3, 40, 17),
      deco("grouper", "back", 26, 53, 9),
      deco("grouper", "back", 38, 28, 20),
      deco("grouper", "front", 14, 60, 46),
    ],
    align: "right",
    bag: { left: 45.75, top: 29.32, width: 43.92 },
  },
  blend: {
    decorativeImages: [
      deco("frame-c", "back", 10, 11, 33),
      deco("frame-b", "back", 6, 15, 37),
      deco("beans", "back", 3, 2, 13),
      deco("marlin", "front", 12, 33, 86),
    ],
    align: "right",
    bag: { left: 8.01, top: 12.67, width: 38.25 },
  },
};

/** Used for any product without an entry in the map. */
export const DEFAULT_PRESENTATION: Readonly<{
  decorativeImages: readonly Decoration[];
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
  const { decorativeImages, align, bag } = getPresentation(product.slug);
  return {
    ...product,
    decorativeImages: [...decorativeImages],
    align,
    ...(bag && { bag }),
  };
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
