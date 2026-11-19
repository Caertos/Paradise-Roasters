import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  castillo,
  categories,
  json,
  makePage,
  pendingUntilAborted,
  pinkBourbon,
} from "./catalogFixtures";
import Products from "./Products";

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

function LocationSearch() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderProducts(entry = "/products") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Products />
      <LocationSearch />
    </MemoryRouter>,
  );
}

/** Answers /categories and /products?... with fresh responses. */
function serveCatalog(products = [castillo, pinkBourbon]) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith(`${API_BASE}/categories`)) {
      return json(200, { data: categories });
    }
    return json(200, makePage(products));
  });
}

function productRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.startsWith(`${API_BASE}/products`));
}

describe("/products", () => {
  it("renders the products from the API, each linking to its page", async () => {
    serveCatalog();
    renderProducts();

    const link = await screen.findByRole("link", { name: /^Pink Bourbon/ });
    expect(link).toHaveAttribute("href", "/products/pink-bourbon");
    expect(screen.getByText("The Nassau Grouper")).toBeInTheDocument();
    expect(screen.getByText("$22.00")).toBeInTheDocument();
    expect(screen.getByText("$20.00")).toBeInTheDocument();
    expect(productRequests()).toEqual([`${API_BASE}/products`]);

    const img = screen.getByAltText(
      "Paradise Roasters pink-bourbon coffee bag, front",
    );
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width", "800");
    expect(img).toHaveAttribute("height", "1000");
    expect(img.getAttribute("srcset")).toContain(
      "pink-bourbon-front-400.webp 400w",
    );
    expect(img.getAttribute("srcset")).toContain(
      "pink-bourbon-front-1600.webp 1600w",
    );
    expect(img).toHaveAttribute("sizes");
  });

  it("shows loading skeletons while the products load", () => {
    fetchMock.mockImplementation(pendingUntilAborted);
    renderProducts();

    expect(
      screen.getByRole("status", { name: "Loading products" }),
    ).toBeInTheDocument();
  });

  it("shows an error with a Try again button that refetches", async () => {
    let failProducts = true;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith(`${API_BASE}/categories`)) {
        return json(200, { data: categories });
      }
      if (failProducts) return json(500, { message: "Server Error" });
      return json(200, makePage([pinkBourbon]));
    });
    renderProducts();
    const user = userEvent.setup();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load the coffees.");

    failProducts = false;
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("link", { name: /^Pink Bourbon/ }),
    ).toBeInTheDocument();
    expect(productRequests()).toHaveLength(2);
  });

  it("shows an empty state when nothing matches", async () => {
    serveCatalog([]);
    renderProducts("/products?roast=light");

    expect(
      await screen.findByText("No coffees match these filters."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });

  it("reads the filters from the URL on load", async () => {
    serveCatalog();
    renderProducts("/products?roast=medium&sort=price_asc&page=2");

    await screen.findByRole("link", { name: /^Pink Bourbon/ });
    expect(productRequests()).toEqual([
      `${API_BASE}/products?roast=medium&sort=price_asc&page=2`,
    ]);
    expect(screen.getByRole("button", { name: "Medium" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Sort by")).toHaveValue("price_asc");
  });

  it("a roast chip updates the URL query, resets the page and refetches", async () => {
    serveCatalog();
    renderProducts("/products?sort=name&page=2");
    const user = userEvent.setup();
    await screen.findByRole("link", { name: /^Pink Bourbon/ });

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(screen.getByTestId("search")).toHaveTextContent(
      "?sort=name&roast=dark",
    );
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await screen.findByRole("link", { name: /^Pink Bourbon/ });
    expect(productRequests()).toEqual([
      `${API_BASE}/products?sort=name&page=2`,
      `${API_BASE}/products?roast=dark&sort=name`,
    ]);
  });

  it("a category chip updates the URL query and refetches", async () => {
    serveCatalog();
    renderProducts();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Coffee" }));

    expect(screen.getByTestId("search")).toHaveTextContent("?category=coffee");
    await screen.findByRole("link", { name: /^Pink Bourbon/ });
    expect(productRequests().at(-1)).toBe(
      `${API_BASE}/products?category=coffee`,
    );

    await user.click(screen.getByRole("button", { name: "All categories" }));
    expect(screen.getByTestId("search")).toBeEmptyDOMElement();
  });

  it("the sort select updates the URL query and refetches", async () => {
    serveCatalog();
    renderProducts("/products?roast=medium");
    const user = userEvent.setup();
    await screen.findByRole("link", { name: /^Pink Bourbon/ });

    await user.selectOptions(screen.getByLabelText("Sort by"), "price_desc");

    expect(screen.getByTestId("search")).toHaveTextContent(
      "?roast=medium&sort=price_desc",
    );
    await screen.findByRole("link", { name: /^Pink Bourbon/ });
    expect(productRequests().at(-1)).toBe(
      `${API_BASE}/products?roast=medium&sort=price_desc`,
    );

    // Back to the default order drops the param.
    await user.selectOptions(screen.getByLabelText("Sort by"), "featured");
    expect(screen.getByTestId("search")).toHaveTextContent("?roast=medium");
  });

  it("paginates through the URL", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith(`${API_BASE}/categories`)) {
        return json(200, { data: categories });
      }
      const page = url.includes("page=2") ? 2 : 1;
      return json(
        200,
        makePage([page === 1 ? castillo : pinkBourbon], {
          current_page: page,
          last_page: 2,
          total: 2,
          per_page: 1,
        }),
      );
    });
    renderProducts("/products?roast=medium");
    const user = userEvent.setup();

    await screen.findByRole("link", { name: /^Castillo/ });
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByTestId("search")).toHaveTextContent(
      "?roast=medium&page=2",
    );
    expect(
      await screen.findByRole("link", { name: /^Pink Bourbon/ }),
    ).toBeInTheDocument();
    expect(productRequests().at(-1)).toBe(
      `${API_BASE}/products?roast=medium&page=2`,
    );
  });
});
