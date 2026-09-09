/**
 * Pre-existing bugs preserved verbatim by the TypeScript conversion.
 *
 * Both names below are read at runtime without ever being declared or assigned,
 * so each one throws `ReferenceError` and the surrounding request fails with a
 * 500. That is exactly what the JavaScript version did, and the conversion is
 * required to change nothing, so the behaviour is kept as-is.
 *
 * These declarations are types only: a `.d.ts` emits no JavaScript, so the
 * `ReferenceError` still happens at exactly the same point it always did.
 *
 * Remove an entry here only together with a real fix at the call site.
 *
 *  - `id` — services/repairingService.ts, inside the "Not enough quantity for
 *    component with ID ${id}" template. The surrounding loop names the variable
 *    `componentId`, so this branch throws instead of returning its intended 400.
 */

declare var id: any;
