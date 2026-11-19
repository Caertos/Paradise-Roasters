import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  castillo,
  json,
  makePage,
  pendingUntilAborted,
  pinkBourbon,
} from "@/pages/products/catalogFixtures";
import HomeProducts from "./HomeProducts";

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

class NoopObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IntersectionObserver", NoopObserver);
});

// The Vitest setup does not enable globals, so RTL cannot auto-clean.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderHomeProducts() {
  return render(
    <MemoryRouter>
      <HomeProducts />
    </MemoryRouter>,
  );
}

function cards(container: HTMLElement) {
  return Array.from(container.querySelectorAll(".products-overlay > *"));
}

describe("home product cards", () => {
  it("renders featured products from the API, linking to their pages", async () => {
    fetchMock.mockResolvedValue(json(200, makePage([castillo, pinkBourbon])));
    const { container } = renderHomeProducts();

    const link = await screen.findByRole("link", { name: "Castillo" });
    expect(link).toHaveAttribute("href", "/products/castillo");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${API_BASE}/products?featured=1`,
    );
    expect(screen.getByText("$20.00")).toBeInTheDocument();
    const img = screen.getByAltText(
      "Paradise Roasters castillo coffee bag, front",
    );
    expect(img.getAttribute("srcset")).toContain(
      "castillo-front-800.webp 800w",
    );

    // Order: first product, the two coming-soon cards, then the rest.
    const order = cards(container).map((el) => el.getAttribute("data-card"));
    expect(order).toEqual(["castillo", "conch", "turtle", "pink-bourbon"]);
  });

  it("layers frames, beans, the real bag and the animal as separate images", async () => {
    fetchMock.mockResolvedValue(json(200, makePage([castillo])));
    const { container } = renderHomeProducts();

    const bag = await screen.findByAltText(
      "Paradise Roasters castillo coffee bag, front",
    );
    const art = container.querySelector<HTMLElement>(
      '[data-card="castillo"] .product-card__art',
    )!;
    const layers = Array.from(art.querySelectorAll("img"));
    const srcs = layers.map((img) =>
      img === bag ? "BAG" : img.getAttribute("src"),
    );
    expect(srcs).toEqual([
      "/products/decor/frame-a.webp",
      "/products/decor/frame-c.webp",
      "/products/decor/beans.webp",
      "BAG",
      "/products/decor/flamingo.webp",
    ]);
    for (const img of layers.filter((img) => img !== bag)) {
      expect(img).toHaveAttribute("alt", "");
      expect(img).toHaveClass("product-card__decor");
    }
    expect(bag.style.left).toBe("24%");
    expect(bag.style.top).toBe("14%");
    expect(bag.style.width).toBe("50%");
  });

  it("renders a product without a presentation entry without decorations", async () => {
    fetchMock.mockResolvedValue(
      json(200, makePage([{ ...castillo, slug: "new-coffee", name: "New" }])),
    );
    const { container } = renderHomeProducts();

    await screen.findByRole("link", { name: "New" });
    const card = container.querySelector('[data-card="new-coffee"]')!;
    expect(card.querySelectorAll(".product-card__decor")).toHaveLength(0);
    expect(
      card.querySelector(
        'img[alt="Paradise Roasters castillo coffee bag, front"]',
      ),
    ).toBeInTheDocument();
  });

  it("marks Conch and Turtle as coming soon, with no price or link", async () => {
    fetchMock.mockResolvedValue(json(200, makePage([castillo])));
    const { container } = renderHomeProducts();
    await screen.findByRole("link", { name: "Castillo" });

    for (const id of ["conch", "turtle"]) {
      const card = container.querySelector<HTMLElement>(`[data-card="${id}"]`);
      expect(card).not.toBeNull();
      const scoped = within(card!);
      expect(scoped.getByText("Coming soon")).toBeInTheDocument();
      expect(scoped.queryByRole("link")).not.toBeInTheDocument();
      expect(scoped.queryByRole("button")).not.toBeInTheDocument();
      expect(scoped.queryByText(/\$/)).not.toBeInTheDocument();
    }
  });

  it("reserves the product slots while loading", () => {
    fetchMock.mockImplementation(pendingUntilAborted);
    const { container } = renderHomeProducts();

    const order = cards(container).map((el) => el.getAttribute("data-card"));
    expect(order).toEqual([
      "placeholder",
      "conch",
      "turtle",
      "placeholder",
      "placeholder",
    ]);
  });
});
