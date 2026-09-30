import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserLink } from "./user-link";
import { linkHost, safeHttpUrl } from "@/lib/safe-url";

describe("links built from data", () => {
  it("keeps only plain http(s) addresses", () => {
    expect(safeHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHttpUrl(" http://example.com ")).toBe("http://example.com/");
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "\u0000javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:x",
      "file:///etc/passwd",
      "//evil.example/x",
      "/relative",
      "https://user:pw@example.com/",
      "not a url",
      "",
      null,
      undefined,
    ]) {
      expect(safeHttpUrl(bad), String(bad)).toBeNull();
    }
    expect(linkHost("https://www.visit-lebanon.org/x")).toBe("www.visit-lebanon.org");
    expect(linkHost("javascript:alert(1)")).toBe("javascript:alert(1)");
  });

  it("renders unsafe addresses as plain text and safe ones as a guarded outside link", () => {
    render(
      <>
        <UserLink href="javascript:alert(1)">bad</UserLink>
        <UserLink href="data:text/html,x">data</UserLink>
        <UserLink href="https://example.com/source">editorial</UserLink>
        <UserLink href="https://example.com/evidence" ugc>
          guide
        </UserLink>
      </>,
    );
    expect(screen.getByText("bad").tagName).toBe("SPAN");
    expect(screen.getByText("data").tagName).toBe("SPAN");
    expect(screen.queryAllByRole("link")).toHaveLength(2);
    const editorial = screen.getByRole("link", { name: "editorial" });
    expect(editorial.getAttribute("rel")).toBe("noopener noreferrer");
    expect(editorial.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("link", { name: "guide" }).getAttribute("rel")).toBe("noopener noreferrer nofollow ugc");
  });
});
