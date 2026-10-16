const Counter = require("../models/Counter");
const Car = require("../models/Car");
const Repairing = require("../models/repairingModel");

/** Highest numeric suffix among [field] values that look like `<prefix><digits>`. */
const maxNumericSuffix = async (Model, field: string, prefix: string) => {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const [row] = await Model.aggregate([
    { $match: { [field]: { $regex: new RegExp(`^${escaped}\\d+$`, "i") } } },
    {
      $project: {
        n: {
          $toLong: {
            $substrCP: [
              `$${field}`,
              { $strLenCP: prefix },
              { $subtract: [{ $strLenCP: `$${field}` }, { $strLenCP: prefix }] },
            ],
          },
        },
      },
    },
    { $group: { _id: null, max: { $max: "$n" } } },
  ]);
  return row ? Number(row.max) : 0;
};

/** Creates the counter at the current highest number the first time it is used. */
const ensureCounter = async (key: string, seed: () => Promise<number>) => {
  const existing = await Counter.findById(key).lean();
  if (existing) return existing.seq;
  const start = await seed();
  try {
    await Counter.updateOne(
      { _id: key },
      { $setOnInsert: { seq: start } },
      { upsert: true },
    );
  } catch (error) {
    // Another request created it first.
    if (error?.code !== 11000) throw error;
  }
  return (await Counter.findById(key).lean()).seq;
};

const takeNext = async (key: string, seed: () => Promise<number>) => {
  await ensureCounter(key, seed);
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true },
  );
  return doc.seq;
};

/**
 * Hands out the next number after [prefix] that no document uses yet.
 * Numbers are never reused, even after a delete. Manually typed numbers
 * that are ahead of the counter are skipped.
 */
const nextFreeCode = async (
  key: string,
  prefix: string,
  seed: () => Promise<number>,
  isTaken: (code: string) => Promise<boolean>,
) => {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const code = `${prefix}${await takeNext(key, seed)}`;
    if (!(await isTaken(code))) return code;
  }
  throw new Error(`Could not find a free code for ${key}`);
};

/** The number the next call would most likely hand out (for suggestions only). */
const peekNext = async (key: string, seed: () => Promise<number>) =>
  (await ensureCounter(key, seed)) + 1;

// ── Invoice numbers (genId = "2021" + n) ─────────────────────────────────────
export const INVOICE_PREFIX = "2021";
const invoiceKey = "repair.genId";
const seedInvoice = () => maxNumericSuffix(Repairing, "genId", INVOICE_PREFIX);

export const nextInvoiceNumber = () =>
  nextFreeCode(invoiceKey, INVOICE_PREFIX, seedInvoice, async (code) =>
    Boolean(await Repairing.exists({ genId: code })),
  );

export const peekInvoiceNumber = () => peekNext(invoiceKey, seedInvoice);

// ── Customer codes (generatedCode = category code + n) ───────────────────────
const carCodeKey = (categoryCode: string) => `car.code.${categoryCode}`;
const seedCarCode = (categoryCode: string) => () =>
  maxNumericSuffix(Car, "generatedCode", categoryCode);

export const nextCarCode = (categoryCode: string) =>
  nextFreeCode(
    carCodeKey(categoryCode),
    categoryCode,
    seedCarCode(categoryCode),
    async (code) => Boolean(await Car.exists({ generatedCode: code })),
  );

export const peekCarCodeNumber = (categoryCode: string) =>
  peekNext(carCodeKey(categoryCode), seedCarCode(categoryCode));
