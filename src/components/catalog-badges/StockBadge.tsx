import type { StockStatus } from "@/lib/catalogApi";
import "./catalog-badges.css";

const STOCK_LABEL: Record<StockStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

export default function StockBadge({ status }: { status: StockStatus }) {
  return (
    <span className={`stock-badge stock-badge--${status}`}>
      {STOCK_LABEL[status]}
    </span>
  );
}
