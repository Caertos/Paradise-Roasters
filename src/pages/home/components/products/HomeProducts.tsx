import { useProducts } from "@/lib/catalogApi";
import { comingSoon, mergePresentation } from "./data";
import ProductCard, {
  ComingSoonCard,
  ProductCardPlaceholder,
} from "./ProductCard";

const FEATURED = { featured: true } as const;
/** Product slots reserved while loading (one before, two after Conch/Turtle). */
const PLACEHOLDER_SLOTS = 3;

/**
 * The cards over the home scene: the first featured product, the
 * "Coming soon" cards, then the remaining featured products. The order keeps
 * the original layout (flamingo, conch, turtle, grouper, marlin), whose
 * positions are set per slot in home.css.
 */
export default function HomeProducts() {
  const { data, status } = useProducts(FEATURED);
  const soon = comingSoon.map((item) => (
    <ComingSoonCard key={item.id} item={item} />
  ));

  if (status === "loading") {
    const slots = Array.from({ length: PLACEHOLDER_SLOTS }, (_, i) => (
      <ProductCardPlaceholder key={`placeholder-${i}`} />
    ));
    return (
      <div className="products-overlay">
        {slots[0]}
        {soon}
        {slots.slice(1)}
      </div>
    );
  }

  const cards = (data?.data ?? []).map((product) => (
    <ProductCard key={product.slug} product={mergePresentation(product)} />
  ));

  return (
    <div className="products-overlay">
      {cards.slice(0, 1)}
      {soon}
      {cards.slice(1)}
    </div>
  );
}
