const path = require("path");

/**
 * Filesystem anchors for code that has to find files at runtime.
 *
 * Sources live at `<repo>/src/**.ts` and compile to `<repo>/dist/**.js`.
 * `__dirname` inside the running code is under `dist/`, so anything that
 * resolves a path from `__dirname` has to be re-anchored.
 *
 * `APP_ROOT`     — root of the compiled JavaScript tree (`<repo>/dist`).
 *                  Use this to find other emitted modules, e.g. the route files
 *                  that swagger-jsdoc scans for `@swagger` comments.
 *
 * `PROJECT_ROOT` — root of the repository (`<repo>`).
 *                  Use this for files that live beside the sources rather than
 *                  in the build output, e.g. static assets and backup folders.
 */
const APP_ROOT: string = path.resolve(__dirname, "..");
const PROJECT_ROOT: string = path.resolve(APP_ROOT, "..");

export = { APP_ROOT, PROJECT_ROOT };
