"use strict";
/**
 * Copies runtime assets that `tsc` does not emit into `dist`.
 *
 * Sources live under `src/`; the compiler only writes JavaScript for `.ts`
 * inputs. Any file a module loads by relative path at runtime — currently the
 * Firebase service account key — would go missing once the code runs from
 * `dist`. This mirrors those files from `src/` into `dist/` so
 * `require("./x.json")` resolves the same way.
 *
 * Deliberately plain JavaScript: build tooling runs before the build exists.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "dist");

const DIRS_TO_SKIP = new Set(["node_modules", ".git"]);

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (DIRS_TO_SKIP.has(entry.name)) continue;
      collect(full, out);
    } else if (entry.name.endsWith(".json")) {
      out.push(path.relative(SRC, full));
    }
  }
  return out;
}

if (!fs.existsSync(SRC)) {
  console.error("copy-assets: src/ not found");
  process.exit(1);
}

const assets = collect(SRC);

for (const rel of assets) {
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(SRC, rel), dest);
}

console.log(`copy-assets: ${assets.length} file(s) -> dist`);
