const assert = require("assert");
const {
  sanitizePersonName,
  hasReceptionInput,
  hasRepresentativeInput,
  resolveReceptionEngineer,
  resolveRepresentative,
} = require("./invoiceAttribution");

assert.strictEqual(resolveReceptionEngineer({}), "NA");
assert.strictEqual(resolveReceptionEngineer({ receptionEngineer: "  " }), "NA");
assert.strictEqual(
  resolveReceptionEngineer({ receptionEngineer: "Adham Mohamed" }),
  "Adham Mohamed",
);
assert.strictEqual(
  resolveReceptionEngineer({ workerName: "Sara\nAli" }),
  "Sara Ali",
);
assert.strictEqual(
  resolveReceptionEngineer({ Reception: "Legacy Reception" }),
  "Legacy Reception",
);

assert.strictEqual(hasReceptionInput({}), false);
assert.strictEqual(hasReceptionInput({ receptionEngineer: "NA" }), true);
assert.strictEqual(hasRepresentativeInput({}), false);
assert.strictEqual(hasRepresentativeInput({ delegate: "x" }), true);

assert.strictEqual(resolveRepresentative({}), null);
assert.strictEqual(resolveRepresentative({ delegate: "  Mandob  " }), "Mandob");
assert.strictEqual(
  resolveRepresentative({ representative: "x".repeat(100) }).length,
  80,
);

assert.strictEqual(sanitizePersonName("ok"), "ok");
assert.strictEqual(sanitizePersonName(null, { fallback: "NA" }), "NA");

console.log("invoiceAttribution tests passed");

export {};
