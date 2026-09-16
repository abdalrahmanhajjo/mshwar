import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogImage, responsiveSrcSet } from "./catalog-image";

describe("CatalogImage", () => {
  it("builds a width-based srcset for Unsplash photos only", () => {
    const set = responsiveSrcSet("https://images.unsplash.com/photo-1?auto=format&w=1600&q=80");
    expect(set?.split(", ")).toHaveLength(5);
    expect(set).toContain("w=480");
    expect(responsiveSrcSet("https://ik.imagekit.io/mshwar/a.jpg")).toBeUndefined();
    expect(responsiveSrcSet("/local.jpg")).toBeUndefined();
  });

  it("lazy-loads by default and eager-loads priority images", () => {
    const { rerender } = render(<CatalogImage src="https://images.unsplash.com/p?w=1600" alt="Harbour" />);
    expect(screen.getByRole("img", { name: "Harbour" })).toHaveAttribute("loading", "lazy");
    rerender(<CatalogImage src="https://images.unsplash.com/p?w=1600" alt="Harbour" priority />);
    expect(screen.getByRole("img", { name: "Harbour" })).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("img", { name: "Harbour" })).toHaveAttribute("sizes", "100vw");
  });

  it("never renders an empty src", () => {
    const { container } = render(<CatalogImage src="" alt="Missing photo" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Missing photo" })).toBeInTheDocument();
  });
});
