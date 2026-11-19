/**
 * Catalog data layer: types, fetchers and hooks for the public product API.
 * Built on the shared `apiRequest` client (base URL, headers, ApiError).
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "./api";

// --- Types -------------------------------------------------------------------

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type RoastLevel = "light" | "medium" | "dark";
export type Grind = "ground" | "whole_bean";
export type ImageSide = "front" | "back" | "detail";
export type ProductSort =
  | "featured"
  | "price_asc"
  | "price_desc"
  | "name"
  | "newest";

/** Amount in minor units (cents) plus a server-formatted label. */
export interface Money {
  amount: number;
  currency: string;
  formatted: string;
}

export interface ProductImage {
  side: ImageSide;
  alt: string;
  /** Absolute URLs: sm 400px, md 800px, lg 1600px (WebP); png 1600px. */
  urls: { sm: string; md: string; lg: string; png: string };
}

export interface CategoryRef {
  slug: string;
  name: string;
}

export interface Category extends CategoryRef {
  description: string | null;
  product_count: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  subtitle: string | null;
  tagline: string | null;
  description: string;
  price: Money;
  stock_status: StockStatus;
  weight_grams: number;
  roast_level: RoastLevel;
  grind: Grind;
  process: string | null;
  varietal: string | null;
  origin: string | null;
  altitude_ft: number | null;
  tasting_notes: string[] | null;
  tasting_summary: string | null;
  is_featured: boolean;
  category: CategoryRef;
  /** The primary image, if any. */
  image: ProductImage | null;
}

export interface ProductDetail extends Product {
  /** All images, primary first. */
  images: ProductImage[];
}

export interface PaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

/** Laravel's standard paginated resource envelope. */
export interface Paginated<T> {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    path: string;
    per_page: number;
    to: number | null;
    total: number;
    links?: PaginationLink[];
  };
}

export interface ProductListParams {
  category?: string;
  featured?: boolean;
  roast?: RoastLevel;
  /** Search text; the API requires at least 2 characters. */
  q?: string;
  sort?: ProductSort;
  per_page?: number;
  page?: number;
}

// --- Fetchers ----------------------------------------------------------------

/** Fixed order so equal params always produce the same query string. */
const PARAM_ORDER = [
  "category",
  "featured",
  "roast",
  "q",
  "sort",
  "per_page",
  "page",
] as const satisfies readonly (keyof ProductListParams)[];

/**
 * Builds `?a=1&b=2` from the params, dropping undefined and empty values.
 * Booleans become `1`/`0` (what Laravel's `boolean` rule accepts).
 * Returns `""` when nothing is set.
 */
export function buildProductQuery(params: ProductListParams): string {
  const search = new URLSearchParams();
  for (const name of PARAM_ORDER) {
    const value = params[name];
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") {
      search.set(name, value ? "1" : "0");
      continue;
    }
    const text = String(value).trim();
    if (text !== "") search.set(name, text);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function fetchProductPage(
  query: string,
  signal?: AbortSignal,
): Promise<Paginated<Product>> {
  return apiRequest<Paginated<Product>>(`/products${query}`, { signal });
}

export function listProducts(
  params: ProductListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Product>> {
  return fetchProductPage(buildProductQuery(params), signal);
}

export async function getProduct(
  slug: string,
  signal?: AbortSignal,
): Promise<ProductDetail> {
  const { data } = await apiRequest<{ data: ProductDetail }>(
    `/products/${encodeURIComponent(slug)}`,
    { signal },
  );
  return data;
}

export async function listCategories(
  signal?: AbortSignal,
): Promise<Category[]> {
  const { data } = await apiRequest<{ data: Category[] }>("/categories", {
    signal,
  });
  return data;
}

// --- Hooks -------------------------------------------------------------------

export type ResourceStatus = "loading" | "success" | "error";

export interface CatalogResource<T> {
  /** Data for the current params; `null` while loading or after an error. */
  data: T | null;
  status: ResourceStatus;
  /** Always an ApiError; network failures use status 0. */
  error: ApiError | null;
  /** Refetches the current params. */
  reload: () => void;
}

interface Settled<T> {
  requestKey: string;
  data: T | null;
  error: ApiError | null;
  status: "success" | "error";
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, "Could not reach the server.");
}

/**
 * Shared fetch-on-key hook. `key` is a string that fully describes the
 * request (e.g. the serialized query string), so new-but-equal params objects
 * never refetch. `load` must be a stable (module-level) function.
 *
 * Each request gets its own AbortController, aborted on key change, reload
 * and unmount. Results are only stored while their request is still current,
 * so nothing is set after unmount and stale responses are dropped.
 */
function useCatalogResource<T>(
  key: string | null,
  load: (key: string, signal: AbortSignal) => Promise<T>,
): CatalogResource<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    const requestKey = `${nonce}|${key}`;

    load(key, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setSettled({ requestKey, data, error: null, status: "success" });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setSettled({
          requestKey,
          data: null,
          error: toApiError(error),
          status: "error",
        });
      },
    );

    return () => controller.abort();
  }, [key, nonce, load]);

  if (key !== null && settled?.requestKey === `${nonce}|${key}`) {
    return {
      data: settled.data,
      status: settled.status,
      error: settled.error,
      reload,
    };
  }
  return { data: null, status: "loading", error: null, reload };
}

const loadProducts = (query: string, signal: AbortSignal) =>
  fetchProductPage(query, signal);
const loadProduct = (slug: string, signal: AbortSignal) =>
  getProduct(slug, signal);
const loadCategories = (_key: string, signal: AbortSignal) =>
  listCategories(signal);

/** A paginated product list; refetches only when the query string changes. */
export function useProducts(
  params: ProductListParams = {},
): CatalogResource<Paginated<Product>> {
  return useCatalogResource(buildProductQuery(params), loadProducts);
}

const MISSING_SLUG_ERROR = new ApiError(404, "Product not found.");

/**
 * One product by slug. An unknown slug ends in `status: "error"` with
 * `error.status === 404`; so does a missing slug, without a request.
 */
export function useProduct(
  slug: string | undefined,
): CatalogResource<ProductDetail> {
  const resource = useCatalogResource(slug || null, loadProduct);
  if (!slug) {
    return { ...resource, status: "error", error: MISSING_SLUG_ERROR };
  }
  return resource;
}

export function useCategories(): CatalogResource<Category[]> {
  return useCatalogResource("categories", loadCategories);
}
