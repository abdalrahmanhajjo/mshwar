import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCAN_DIRS = [
  path.join(process.cwd(), "src/components/ui"),
  path.join(process.cwd(), "src/components/shell"),
];

const FORBIDDEN =
  /\b(?:ml|mr|pl|pr|text-left|text-right|float-left|float-right|rounded-l|rounded-r|border-l|border-r|inset-x-start)-|\b(?:left|right)-(?!1\/2\b)/;

describe("RTL logical properties", () => {
  it("does not use physical left/right layout classes in UI primitives", () => {
    const files = SCAN_DIRS.flatMap((dir) =>
      fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx") && !file.endsWith(".stories.tsx"))
        .map((file) => path.join(dir, file)),
    );
    const violations: string[] = [];
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, "utf8");
      const file = path.relative(path.join(process.cwd(), "src/components"), filePath);
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
