import type { Product } from "@/lib/catalogApi";
import Button from "@/components/button/Button";

/**
 * The single extension point for the cart.
 * TODO(module 3): cart — replace this stub with the real cart action.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function onAddToCart(_product: Product): void {}

interface AddToCartButtonProps {
  product: Product;
  className?: string;
}

/** Always visible; disabled while the product is out of stock. */
export default function AddToCartButton({
  product,
  className,
}: AddToCartButtonProps) {
  return (
    <Button
      className={className}
      disabled={product.stock_status === "out_of_stock"}
      onClick={() => onAddToCart(product)}
    >
      Add to cart
    </Button>
  );
}
