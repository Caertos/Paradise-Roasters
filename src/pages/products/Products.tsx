import { Link, useSearchParams } from "react-router-dom";
import {
  useCategories,
  useProducts,
  type Product,
  type ProductListParams,
  type ProductSort,
  type RoastLevel,
} from "@/lib/catalogApi";
import ProductPhoto from "@/components/product-photo/ProductPhoto";
import StockBadge from "@/components/catalog-badges/StockBadge";
import "./products.css";

const ROASTS: { value: RoastLevel; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "dark", label: "Dark" },
];

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name" },
  { value: "newest", label: "Newest" },
];

const DEFAULT_SORT: ProductSort = "featured";
const SKELETON_COUNT = 3;
const CARD_SIZES = "(max-width: 480px) 100vw, (max-width: 768px) 50vw, 384px";

function isRoast(value: string | null): value is RoastLevel {
  return ROASTS.some((r) => r.value === value);
}

function isSort(value: string | null): value is ProductSort {
  return SORTS.some((s) => s.value === value);
}

/** The API params encoded in the URL; invalid values are ignored. */
function readParams(search: URLSearchParams): ProductListParams {
  const roast = search.get("roast");
  const sort = search.get("sort");
  const page = Number(search.get("page"));
  return {
    category: search.get("category") || undefined,
    roast: isRoast(roast) ? roast : undefined,
    sort: isSort(sort) && sort !== DEFAULT_SORT ? sort : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}

export default function Products() {
  const [search, setSearch] = useSearchParams();
  const params = readParams(search);
  const products = useProducts(params);
  const categories = useCategories();

  /** Sets (or clears) one filter; any filter change goes back to page 1. */
  function setFilter(name: "category" | "roast" | "sort", value?: string) {
    const next = new URLSearchParams(search);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("page");
    setSearch(next);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(search);
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    setSearch(next);
  }

  const hasFilters = Boolean(params.category || params.roast);

  return (
    <div className="products page-bg">
      {/* ── Hero ── */}
      <section className="page-hero">
        <div className="container">
          <h1 className="page-hero__title">Our Products</h1>
          <p className="page-hero__subtitle">
            100% Colombian specialty coffee, roasted in small batches and packed
            by Paradise Roasters in Nassau, Bahamas.
          </p>
        </div>
      </section>

      {/* ── Catalog ── */}
      <section className="products-grid-section">
        <div className="container">
          <h2 className="section-title section-title--center">
            Explore the Collection
          </h2>

          <div className="catalog-filters">
            <div
              className="catalog-filters__group"
              role="group"
              aria-label="Category"
            >
              <Chip
                label="All categories"
                pressed={!params.category}
                onClick={() => setFilter("category")}
              />
              {categories.data?.map((c) => (
                <Chip
                  key={c.slug}
                  label={c.name}
                  pressed={params.category === c.slug}
                  onClick={() => setFilter("category", c.slug)}
                />
              ))}
            </div>

            <div
              className="catalog-filters__group"
              role="group"
              aria-label="Roast"
            >
              <Chip
                label="All roasts"
                pressed={!params.roast}
                onClick={() => setFilter("roast")}
              />
              {ROASTS.map((r) => (
                <Chip
                  key={r.value}
                  label={r.label}
                  pressed={params.roast === r.value}
                  onClick={() => setFilter("roast", r.value)}
                />
              ))}
            </div>

            <label className="catalog-filters__sort">
              <span>Sort by</span>
              <select
                value={params.sort ?? DEFAULT_SORT}
                onChange={(e) =>
                  setFilter(
                    "sort",
                    e.target.value === DEFAULT_SORT
                      ? undefined
                      : e.target.value,
                  )
                }
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {products.status === "loading" && (
            <div
              className="products-grid"
              role="status"
              aria-label="Loading products"
            >
              {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <div key={i} className="pr-card pr-card--skeleton">
                  <div className="image-placeholder pr-card__media" />
                  <div className="pr-card__skeleton-line" />
                  <div className="pr-card__skeleton-line pr-card__skeleton-line--short" />
                </div>
              ))}
            </div>
          )}

          {products.status === "error" && (
            <div className="catalog-message" role="alert">
              <p>We couldn't load the coffees. Please try again.</p>
              <button
                type="button"
                className="catalog-message__button"
                onClick={products.reload}
              >
                Try again
              </button>
            </div>
          )}

          {products.status === "success" && products.data && (
            <>
              {products.data.data.length === 0 ? (
                <div className="catalog-message">
                  <p>No coffees match these filters.</p>
                  {hasFilters && (
                    <button
                      type="button"
                      className="catalog-message__button"
                      onClick={() => setSearch(new URLSearchParams())}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="products-grid">
                  {products.data.data.map((p) => (
                    <ProductTile key={p.id} product={p} />
                  ))}
                </div>
              )}

              <Pagination meta={products.data.meta} onPage={goToPage} />
            </>
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="products-cta">
        <div className="products-cta__inner container">
          <h2 className="products-cta__title">Can't Decide?</h2>
          <p className="products-cta__text">
            Get to know us better — read the story behind our roasts and the
            farms we partner with.
          </p>
          <Link to="/about" className="products-cta__button">
            Visit Our Story
          </Link>
        </div>
      </section>
    </div>
  );
}

interface ChipProps {
  label: string;
  pressed: boolean;
  onClick: () => void;
}

function Chip({ label, pressed, onClick }: ChipProps) {
  return (
    <button
      type="button"
      className="catalog-chip"
      aria-pressed={pressed}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ProductTile({ product }: { product: Product }) {
  const href = `/products/${product.slug}`;
  return (
    <article className="pr-card">
      <Link
        to={href}
        className="pr-card__media-link"
        tabIndex={-1}
        aria-hidden="true"
      >
        {product.image ? (
          <ProductPhoto
            image={product.image}
            sizes={CARD_SIZES}
            className="pr-card__media"
          />
        ) : (
          <div className="image-placeholder pr-card__media" />
        )}
      </Link>
      <h3 className="pr-card__name">
        <Link to={href} className="pr-card__link">
          {product.name}
          {product.subtitle && (
            <span className="pr-card__subtitle">{product.subtitle}</span>
          )}
        </Link>
      </h3>
      {product.tagline && (
        <span className="pr-card__tagline">{product.tagline}</span>
      )}
      <p className="pr-card__desc">{product.description}</p>
      <div className="pr-card__footer">
        <span className="pr-card__price">{product.price.formatted}</span>
        <StockBadge status={product.stock_status} />
      </div>
    </article>
  );
}

interface PaginationProps {
  meta: { current_page: number; last_page: number };
  onPage: (page: number) => void;
}

function Pagination({ meta, onPage }: PaginationProps) {
  const { current_page: current, last_page: last } = meta;
  if (last <= 1) return null;
  return (
    <nav className="catalog-pagination" aria-label="Pagination">
      <button
        type="button"
        className="catalog-pagination__button"
        aria-label="Previous page"
        disabled={current <= 1}
        onClick={() => onPage(current - 1)}
      >
        ← Prev
      </button>
      <span className="catalog-pagination__status">
        Page {current} of {last}
      </span>
      <button
        type="button"
        className="catalog-pagination__button"
        aria-label="Next page"
        disabled={current >= last}
        onClick={() => onPage(current + 1)}
      >
        Next →
      </button>
    </nav>
  );
}
