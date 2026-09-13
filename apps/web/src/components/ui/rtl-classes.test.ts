import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCAN_ROOT = path.join(process.cwd(), "src/components");

const FORBIDDEN =
  /\b(?:ml|mr|pl|pr|text-left|text-right|float-left|float-right|rounded-l|rounded-r|border-l|border-r|inset-x-start)-|\b(?:left|right)-(?!1\/2\b)/;

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__snapshots__" || entry.name === "node_modules") {
        return [];
      }
      return listSourceFiles(full);
    }
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx") || entry.name.endsWith(".stories.tsx")) {
      return [];
    }
    if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      return [full];
    }
    return [];
  });
}

describe("RTL logical properties", () => {
  it("does not use physical left/right layout classes in UI components", () => {
    const files = listSourceFiles(SCAN_ROOT);
    const violations: string[] = [];
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, "utf8");
      const file = path.relative(SCAN_ROOT, filePath);
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
