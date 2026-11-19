import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE, json, makeDetail } from "../products/catalogFixtures";
import ProductDetail from "./ProductDetail";

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

// The Vitest setup does not enable globals, so RTL cannot auto-clean.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderDetail(slug = "pink-bourbon") {
  return render(
    <MemoryRouter initialEntries={[`/products/${slug}`]}>
      <Routes>
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/products" element={<h1>Catalog</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

const FRONT_ALT = "Paradise Roasters pink-bourbon coffee bag, front";
const BACK_ALT = "Paradise Roasters pink-bourbon coffee bag, back";

describe("/products/:slug", () => {
  it("renders the product", async () => {
    fetchMock.mockResolvedValue(json(200, { data: makeDetail() }));
    renderDetail();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Pink Bourbon" }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE}/products/pink-bourbon`,
    );
    expect(screen.getByText("The Nassau Grouper")).toBeInTheDocument();
    expect(screen.getByText("Community and Stability")).toBeInTheDocument();
    expect(screen.getByText("$22.00")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Roast level: Medium, 2 of 4" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ground")).toBeInTheDocument();
    expect(screen.getByText("250 g")).toBeInTheDocument();
    expect(screen.getByText("Washed")).toBeInTheDocument();
    expect(screen.getByText("Buenavista, Colombia")).toBeInTheDocument();
    expect(screen.getByText("5,900 ft")).toBeInTheDocument();
    for (const note of ["Chocolate", "Amaretto", "Vanilla"]) {
      expect(screen.getByText(note)).toBeInTheDocument();
    }
    expect(screen.getByText("Coffee")).toBeInTheDocument();
    expect(screen.getByText(/the Grouper keeps balance/)).toBeInTheDocument();
    expect(document.title).toBe("Pink Bourbon — Paradise Roasters");
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });

  it("shows the tasting summary when there are no notes", async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        data: makeDetail({
          slug: "blend",
          name: "Blend",
          roast_level: "dark",
          tasting_notes: null,
          tasting_summary: "Each bag is unique, no two are exactly alike.",
          altitude_ft: null,
        }),
      }),
    );
    renderDetail("blend");

    expect(
      await screen.findByText("Each bag is unique, no two are exactly alike."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Roast level: Dark, 4 of 4" }),
    ).toBeInTheDocument();
  });

  it("shows the front by default and toggles to the back and back again", async () => {
    fetchMock.mockResolvedValue(json(200, { data: makeDetail() }));
    renderDetail();
    const user = userEvent.setup();

    const showFront = await screen.findByRole("button", { name: "Show front" });
    const showBack = screen.getByRole("button", { name: "Show back" });
    expect(showFront).toHaveAttribute("aria-pressed", "true");
    expect(showBack).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("img", { name: FRONT_ALT })).toBeInTheDocument();

    await user.click(showBack);
    expect(showBack).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: BACK_ALT })).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: FRONT_ALT }),
    ).not.toBeInTheDocument();

    // Keyboard: focus the front toggle and activate it with Enter.
    showFront.focus();
    await user.keyboard("{Enter}");
    expect(showFront).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: FRONT_ALT })).toBeInTheDocument();
  });

  it("disables Add to cart when the product is out of stock", async () => {
    fetchMock.mockResolvedValue(
      json(200, { data: makeDetail({ stock_status: "out_of_stock" }) }),
    );
    renderDetail();

    expect(
      await screen.findByRole("button", { name: "Add to cart" }),
    ).toBeDisabled();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("shows the not-found view for an unknown slug", async () => {
    fetchMock.mockResolvedValue(json(404, { message: "Product not found." }));
    renderDetail("nope");
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "Coffee not found" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Browse all coffees" }));
    expect(
      screen.getByRole("heading", { name: "Catalog" }),
    ).toBeInTheDocument();
  });

  it("shows an error with Try again for other failures", async () => {
    fetchMock
      .mockResolvedValueOnce(json(500, { message: "Server Error" }))
      .mockResolvedValue(json(200, { data: makeDetail() }));
    renderDetail();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Pink Bourbon" }),
    ).toBeInTheDocument();
  });
});
