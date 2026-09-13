import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const UI_DIR = path.join(process.cwd(), "src/components/ui");

const FORBIDDEN =
  /\b(?:ml|mr|pl|pr|text-left|text-right|float-left|float-right|rounded-l|rounded-r|border-l|border-r|inset-x-start)-|\b(?:left|right)-(?!1\/2\b)/;

describe("RTL logical properties", () => {
  it("does not use physical left/right layout classes in UI primitives", () => {
    const files = fs
      .readdirSync(UI_DIR)
      .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx") && !file.endsWith(".stories.tsx"));
    const violations: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(path.join(UI_DIR, file), "utf8");
      for (const [index, line] of source.split("\n").entries()) {
        if (
          FORBIDDEN.test(line) &&
          !line.includes("left-1/2") &&
          !line.includes("ArrowLeft") &&
          !line.includes("ArrowRight")
        ) {
          violations.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
