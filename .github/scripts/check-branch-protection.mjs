// Every required check in .github/branch-protection.json must be the name of a job that runs
// on pull requests; a typo or a renamed job would otherwise leave main unprotected or block
// every merge forever. Run in CI (ci.yml, "Formatting (all files)").
import { readFileSync, readdirSync } from "node:fs";

const protection = JSON.parse(readFileSync(".github/branch-protection.json", "utf8"));
const names = new Set();
for (const file of readdirSync(".github/workflows").filter((name) => name.endsWith(".yml"))) {
  const text = readFileSync(`.github/workflows/${file}`, "utf8");
  if (!/^\s{2}pull_request:/m.test(text) && !/^on:.*pull_request/m.test(text)) continue;
  const images = [...text.matchAll(/^\s+- image: (\S+)/gm)].map((match) => match[1]);
  for (const match of text.matchAll(/^ {4}name: (.+)$/gm)) {
    const name = match[1].trim().replace(/^["']|["']$/g, "");
    if (name.includes("${{ matrix.image }}")) {
      for (const image of images) names.add(name.replace("${{ matrix.image }}", image));
    } else {
      names.add(name);
    }
  }
}
const missing = protection.required_status_checks.contexts.filter((context) => !names.has(context));
if (missing.length) {
  console.error(`branch-protection.json names checks that no pull-request job produces: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`branch protection: ${protection.required_status_checks.contexts.length} required checks, all real`);
