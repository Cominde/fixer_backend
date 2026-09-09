"use strict";
/**
 * Copies runtime assets that `tsc` does not emit into `dist`.
 *
 * The compiler only writes JavaScript for `.ts` inputs, so any file a module
 * loads by relative path at runtime — currently the Firebase service account
 * key — would go missing once the code runs from `dist`. This mirrors those
 * files into the build output so `require("./x.json")` resolves exactly as it
 * did when the JavaScript ran in place.
 *
 * Deliberately plain JavaScript: build tooling runs before the build exists.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "dist");

// Root-level config that belongs to the toolchain, not the running app.
const ROOT_FILES_TO_SKIP = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  ".eslintrc.json",
]);

const DIRS_TO_SKIP = new Set(["node_modules", ".git", "dist", "tools", "backups"]);

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (DIRS_TO_SKIP.has(entry.name)) continue;
      collect(full, out);
    } else if (entry.name.endsWith(".json")) {
      const rel = path.relative(ROOT, full);
      if (!rel.includes(path.sep) && ROOT_FILES_TO_SKIP.has(entry.name)) continue;
      out.push(rel);
    }
  }
  return out;
}

const assets = collect(ROOT);

for (const rel of assets) {
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), dest);
}

console.log(`copy-assets: ${assets.length} file(s) -> dist`);
