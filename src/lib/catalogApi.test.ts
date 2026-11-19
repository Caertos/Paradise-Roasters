import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import {
  buildProductQuery,
  getProduct,
  listCategories,
  listProducts,
  useCategories,
  useProduct,
  useProducts,
  type Category,
  type Paginated,
  type Product,
  type ProductDetail,
  type ProductImage,
} from "./catalogApi";

const BASE = "http://api.test/api";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const image: ProductImage = {
  side: "front",
  alt: "Pink Bourbon bag, front",
  urls: {
    sm: "http://api.test/storage/products/pink-bourbon/front-400.webp",
    md: "http://api.test/storage/products/pink-bourbon/front-800.webp",
    lg: "http://api.test/storage/products/pink-bourbon/front-1600.webp",
    png: "http://api.test/storage/products/pink-bourbon/front-1600.png",
  },
};

const product: Product = {
  id: 2,
  slug: "pink-bourbon",
  name: "Pink Bourbon",
  subtitle: "The Nassau Grouper",
  tagline: null,
  description: "A bright, floral coffee.",
  price: { amount: 1800, currency: "USD", formatted: "$18.00" },
  stock_status: "low_stock",
  weight_grams: 340,
  roast_level: "medium",
  grind: "whole_bean",
  process: "Washed",
  varietal: "Pink Bourbon",
  origin: "Quindío, Colombia",
  altitude_ft: 5900,
  tasting_notes: ["Red fruit", "Panela"],
  tasting_summary: null,
  is_featured: true,
  category: { slug: "coffee", name: "Coffee" },
  image,
};

const detail: ProductDetail = {
  ...product,
  images: [image, { ...image, side: "back", alt: "Pink Bourbon bag, back" }],
};

const page: Paginated<Product> = {
  data: [product],
  links: {
    first: `${BASE}/products?page=1`,
    last: `${BASE}/products?page=1`,
    prev: null,
    next: null,
  },
  meta: {
    current_page: 1,
    from: 1,
    last_page: 1,
    path: `${BASE}/products`,
    per_page: 12,
    to: 1,
    total: 1,
  },
};

const categories: Category[] = [
  { slug: "coffee", name: "Coffee", description: null, product_count: 3 },
];

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function requestedUrl(call = 0): string {
  return String(fetchMock.mock.calls[call][0]);
}

function signalOf(call = 0): AbortSignal {
  const signal = fetchMock.mock.calls[call][1]?.signal;
  if (!signal) throw new Error(`fetch call ${call} had no signal`);
  return signal;
}

/** A fetch that never settles until its signal aborts, like a real one. */
function pendingUntilAborted(_url: unknown, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")),
    );
  });
}

describe("buildProductQuery", () => {
  it("returns an empty string when no params are set", () => {
    expect(buildProductQuery({})).toBe("");
  });

  it("drops undefined and empty params and keeps a stable order", () => {
    expect(
      buildProductQuery({
        sort: "price_asc",
        q: "  ",
        category: "",
        roast: "medium",
        page: 2,
        per_page: undefined,
      }),
    ).toBe("?roast=medium&sort=price_asc&page=2");
  });

  it("serializes featured as a Laravel boolean and trims the search", () => {
    expect(buildProductQuery({ featured: true, q: " bourbon " })).toBe(
      "?featured=1&q=bourbon",
    );
    expect(buildProductQuery({ featured: false })).toBe("?featured=0");
  });

  it("encodes values", () => {
    expect(buildProductQuery({ q: "café & co" })).toBe("?q=caf%C3%A9+%26+co");
  });
});

describe("catalog fetchers", () => {
  it("listProducts parses the paginated envelope and sends the query", async () => {
    fetchMock.mockResolvedValueOnce(json(200, page));
    const controller = new AbortController();

    await expect(
      listProducts({ category: "coffee", per_page: 12 }, controller.signal),
    ).resolves.toEqual(page);

    expect(requestedUrl()).toBe(`${BASE}/products?category=coffee&per_page=12`);
    expect(signalOf()).toBe(controller.signal);
  });

  it("getProduct unwraps the detail resource and encodes the slug", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: detail }));

    await expect(getProduct("pink bourbon")).resolves.toEqual(detail);
    expect(requestedUrl()).toBe(`${BASE}/products/pink%20bourbon`);
  });

  it("listCategories unwraps the collection", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: categories }));

    await expect(listCategories()).resolves.toEqual(categories);
    expect(requestedUrl()).toBe(`${BASE}/categories`);
  });

  it("getProduct rejects with a 404 ApiError for an unknown slug", async () => {
    fetchMock.mockResolvedValueOnce(
      json(404, { message: "Product not found." }),
    );

    const error = await getProduct("nope").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: "Product not found." });
  });

  it("listProducts rejects with the field errors of a 422", async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: "The selected roast is invalid.",
        errors: { roast: ["The selected roast is invalid."] },
      }),
    );

    await expect(listProducts({ sort: "price_asc" })).rejects.toMatchObject({
      status: 422,
      errors: { roast: ["The selected roast is invalid."] },
    });
  });
});

describe("useProducts", () => {
  it("goes from loading to success", async () => {
    fetchMock.mockResolvedValueOnce(json(200, page));

    const { result } = renderHook(() => useProducts({ featured: true }));

    expect(result.current.status).toBe("loading");
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual(page);
    expect(result.current.error).toBeNull();
    expect(requestedUrl()).toBe(`${BASE}/products?featured=1`);
  });

  it("does not refetch when re-rendered with an equal params object", async () => {
    fetchMock.mockResolvedValue(json(200, page));

    const { result, rerender } = renderHook(
      ({ params }) => useProducts(params),
      { initialProps: { params: { roast: "dark" as const } } },
    );
    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ params: { roast: "dark" as const } });
    rerender({ params: { roast: "dark" as const } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts the in-flight request when params change and refetches", async () => {
    fetchMock.mockImplementationOnce(pendingUntilAborted);
    fetchMock.mockResolvedValueOnce(json(200, page));

    const { result, rerender } = renderHook(
      ({ params }) => useProducts(params),
      { initialProps: { params: { page: 1 } } },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ params: { page: 2 } });

    expect(signalOf(0).aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(1)).toBe(`${BASE}/products?page=2`);
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(page);
  });

  it("aborts on unmount and never sets state afterwards", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((r) => (resolve = r)),
    );

    const { result, unmount } = renderHook(() => useProducts({}));
    unmount();

    expect(signalOf().aborted).toBe(true);
    // The server answers after unmount; the hook must ignore it.
    await act(async () => resolve(json(200, page)));
    expect(result.current.status).toBe("loading");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("exposes errors and reload refetches", async () => {
    fetchMock.mockResolvedValueOnce(json(500, { message: "Server Error" }));
    fetchMock.mockResolvedValueOnce(json(200, page));

    const { result } = renderHook(() => useProducts({}));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(500);
    expect(result.current.data).toBeNull();

    act(() => result.current.reload());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(page);
  });
});

describe("useProduct", () => {
  it("loads the detail", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: detail }));

    const { result } = renderHook(() => useProduct("pink-bourbon"));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual(detail);
  });

  it("lets callers tell a 404 apart", async () => {
    fetchMock.mockResolvedValueOnce(
      json(404, { message: "Product not found." }),
    );

    const { result } = renderHook(() => useProduct("nope"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.status).toBe(404);
  });

  it("reports a missing slug as a 404 without fetching", () => {
    const { result } = renderHook(() => useProduct(undefined));

    expect(result.current.status).toBe("error");
    expect(result.current.error?.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts the previous slug request when the slug changes", async () => {
    fetchMock.mockImplementationOnce(pendingUntilAborted);
    fetchMock.mockResolvedValueOnce(json(200, { data: detail }));

    const { result, rerender } = renderHook(({ slug }) => useProduct(slug), {
      initialProps: { slug: "blend" },
    });
    rerender({ slug: "pink-bourbon" });

    expect(signalOf(0).aborted).toBe(true);
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual(detail);
  });
});

describe("useCategories", () => {
  it("loads the categories", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: categories }));

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual(categories);
  });

  it("wraps network failures in an error state", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(0);
  });
});
