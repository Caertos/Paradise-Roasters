/**
 * Test fixtures for the catalog pages: API-shaped products and a fetch
 * router for `vi.stubGlobal("fetch", ...)`. Test-only; never imported by
 * application code.
 */
import type {
  Category,
  Paginated,
  Product,
  ProductDetail,
  ProductImage,
} from "@/lib/catalogApi";

export const API_BASE = "http://api.test/api";

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeImage(slug: string, side: "front" | "back"): ProductImage {
  const base = `http://api.test/storage/products/${slug}-${side}`;
  return {
    side,
    alt: `Paradise Roasters ${slug} coffee bag, ${side}`,
    urls: {
      sm: `${base}-400.webp`,
      md: `${base}-800.webp`,
      lg: `${base}-1600.webp`,
      png: `${base}-1600.png`,
    },
  };
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  const slug = overrides.slug ?? "pink-bourbon";
  return {
    id: 2,
    slug,
    name: "Pink Bourbon",
    subtitle: "The Nassau Grouper",
    tagline: "Community and Stability",
    description: "As a cornerstone of the reef, the Grouper keeps balance.",
    price: { amount: 2200, currency: "USD", formatted: "$22.00" },
    stock_status: "in_stock",
    weight_grams: 250,
    roast_level: "medium",
    grind: "ground",
    process: "Washed",
    varietal: "Pink Bourbon",
    origin: "Buenavista, Colombia",
    altitude_ft: 5900,
    tasting_notes: ["Chocolate", "Amaretto", "Vanilla"],
    tasting_summary: null,
    is_featured: true,
    category: { slug: "coffee", name: "Coffee" },
    image: makeImage(slug, "front"),
    ...overrides,
  };
}

export function makeDetail(
  overrides: Partial<ProductDetail> = {},
): ProductDetail {
  const product = makeProduct(overrides);
  return {
    ...product,
    images: [makeImage(product.slug, "front"), makeImage(product.slug, "back")],
    ...overrides,
  };
}

export const castillo = makeProduct({
  id: 3,
  slug: "castillo",
  name: "Castillo",
  subtitle: "The Caribbean Flamingo",
  tagline: "Elegance and Balance",
  price: { amount: 2000, currency: "USD", formatted: "$20.00" },
  varietal: "Castillo",
});

export const pinkBourbon = makeProduct();

export function makePage(
  data: Product[],
  meta: Partial<Paginated<Product>["meta"]> = {},
): Paginated<Product> {
  return {
    data,
    links: { first: null, last: null, prev: null, next: null },
    meta: {
      current_page: 1,
      from: data.length ? 1 : null,
      last_page: 1,
      path: `${API_BASE}/products`,
      per_page: 12,
      to: data.length || null,
      total: data.length,
      ...meta,
    },
  };
}

export const categories: Category[] = [
  { slug: "coffee", name: "Coffee", description: null, product_count: 3 },
  { slug: "gear", name: "Gear", description: null, product_count: 0 },
];

/** A fetch that never settles until its signal aborts, like a real one. */
export function pendingUntilAborted(_url: unknown, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")),
    );
  });
}
