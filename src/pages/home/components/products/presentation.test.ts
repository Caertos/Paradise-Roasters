import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESENTATION,
  getPresentation,
  mergePresentation,
  productPresentation,
} from "./data";

describe("product presentation map", () => {
  it("pairs each real product with its bag's animal decorations", () => {
    const animal = (slug: string) =>
      productPresentation[slug].decorativeImages.filter(
        (d) => d.layer === "front",
      );
    expect(animal("castillo").map((d) => d.src)).toEqual([
      "/products/decor/flamingo.webp",
    ]);
    expect(animal("pink-bourbon").map((d) => d.src)).toEqual([
      "/products/decor/grouper.webp",
    ]);
    expect(animal("blend").map((d) => d.src)).toEqual([
      "/products/decor/marlin.webp",
    ]);
    expect(productPresentation.castillo.align).toBe("left");
    expect(productPresentation["pink-bourbon"].align).toBe("right");
    expect(productPresentation.blend.align).toBe("right");
  });

  it("holds only presentation: decorations, bag placement and align", () => {
    for (const entry of Object.values(productPresentation)) {
      expect(Object.keys(entry).sort()).toEqual([
        "align",
        "bag",
        "decorativeImages",
      ]);
      for (const d of entry.decorativeImages) {
        expect(Object.keys(d).sort()).toEqual([
          "layer",
          "left",
          "src",
          "top",
          "width",
        ]);
        expect(d.src).toMatch(/^\/products\/decor\/[a-z-]+\.webp$/);
      }
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
      ...productPresentation.castillo,
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
    merged.decorativeImages.push({
      src: "/x.webp",
      layer: "back",
      left: 0,
      top: 0,
      width: 1,
    });
    expect(DEFAULT_PRESENTATION.decorativeImages).toEqual([]);
  });
});
