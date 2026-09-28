// MapLibre 6 runs its tile worker as a separate ES module (maplibre-gl-worker.mjs, which
// imports maplibre-gl-shared.mjs). The bundler does not emit those files, so they are
// served from public/ under the installed version, and the map points setWorkerUrl there.
// Runs before `next build` and `next dev`; the output is generated, not committed.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const pkgDir = path.dirname(require.resolve("maplibre-gl/package.json", { paths: [root] }));
const { version } = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));
const outRoot = path.join(root, "public", "vendor", "maplibre");
const out = path.join(outRoot, version);

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(pkgDir, "dist", file), path.join(out, file));
}
console.log(`maplibre worker ${version} -> public/vendor/maplibre/${version}/`);
