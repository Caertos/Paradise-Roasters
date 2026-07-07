import type { Product } from "./types";

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
    decorativeImages: ["/products/flamingo1.svg", "/products/flamingo2-decorative.png"],
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
