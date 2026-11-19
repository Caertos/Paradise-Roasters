import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESENTATION,
  getPresentation,
  mergePresentation,
  productPresentation,
} from "./data";

describe("product presentation map", () => {
  it("pairs each real product with its bag's animal decorations", () => {
    expect(productPresentation.blend).toEqual({
      decorativeImages: ["/products/marlin-decorative.png"],
      align: "right",
    });
    expect(productPresentation["pink-bourbon"]).toEqual({
      decorativeImages: [
        "/products/grouper1.svg",
        "/products/grouper2.svg",
        "/products/grouper3.svg",
        "/products/grouper4.svg",
      ],
      align: "right",
    });
    expect(productPresentation.castillo).toEqual({
      decorativeImages: [
        "/products/flamingo1.svg",
        "/products/flamingo2-decorative.png",
      ],
      align: "left",
    });
  });

  it("holds only decorativeImages and align", () => {
    for (const entry of Object.values(productPresentation)) {
      expect(Object.keys(entry).sort()).toEqual(["align", "decorativeImages"]);
    }
  });

  it("returns the entry for a known slug", () => {
    expect(getPresentation("blend")).toBe(productPresentation.blend);
  });

  it("falls back to defaults for unknown slugs", () => {
    expect(DEFAULT_PRESENTATION).toEqual({
      decorativeImages: [],
      align: "left",
    });
    expect(getPresentation("unknown-coffee")).toEqual(DEFAULT_PRESENTATION);
    // Inherited object keys are not entries either.
    expect(getPresentation("toString")).toEqual(DEFAULT_PRESENTATION);
  });

  it("merges the presentation into the API product", () => {
    const apiProduct = { slug: "castillo", name: "Castillo" };
    expect(mergePresentation(apiProduct)).toEqual({
      slug: "castillo",
      name: "Castillo",
      decorativeImages: [
        "/products/flamingo1.svg",
        "/products/flamingo2-decorative.png",
      ],
      align: "left",
    });
  });

  it("merges defaults for a product without an entry", () => {
    const merged = mergePresentation({ slug: "new-arrival", name: "New" });
    expect(merged).toEqual({
      slug: "new-arrival",
      name: "New",
      decorativeImages: [],
      align: "left",
    });
  });

  it("does not let callers mutate the shared defaults", () => {
    const merged = mergePresentation({ slug: "new-arrival" });
    merged.decorativeImages.push("/x.png");
    expect(DEFAULT_PRESENTATION.decorativeImages).toEqual([]);
  });
});
