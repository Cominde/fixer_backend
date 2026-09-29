/**
 * Money integrity for repairs.
 *
 * Usage:
 *   node scripts/repairMoneyTotals.js           # dry-run (default)
 *   node scripts/repairMoneyTotals.js --apply   # write ONLY float-drift fixes
 *
 * Sections:
 *   A) FLOAT-DRIFT (auto-fixable with --apply):
 *      priceAfterDiscount != round2(totalPrice - discount)
 *      and/or totalPrice != sum(line prices).
 *      Does NOT rewrite discount.
 *
 *   B) SUSPECTED TRUNCATED DISCOUNTS (REPORT-ONLY, never auto-fixed):
 *      totalPrice has a fractional part AND discount is an integer AND
 *      priceAfterDiscount is fractional.
 *      Suggested discount = totalPrice - Math.round(priceAfterDiscount)
 *      Example: 8417.5 / discount 418 / pad 7999.5 → suggested 417.5
 *
 *   Running --apply does NOT fix truncated-discount rows like repair 202192.
 *
 * Requires DB_URL in config.env. Build first: npm run build
 */
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", "config.env") });

function loadRepairingModel() {
  const mod = require("../dist/models/repairingModel");
  // `export =` compiles to module.exports; some tooling wraps .default.
  return mod && mod.default ? mod.default : mod;
}

const round2 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const toMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const hasFractionalPart = (value) => {
  const n = toMoney(value);
  return Math.abs(n - Math.round(n)) > 0.001;
};

const isIntegerMoney = (value) => !hasFractionalPart(value);

const sumLineTotals = (doc) => {
  let total = 0;
  for (const line of doc.Services || []) total += toMoney(line.price);
  for (const line of doc.additions || []) total += toMoney(line.price);
  for (const line of doc.component || []) total += toMoney(line.price);
  return total;
};

const connectDB = async () => {
  const url = process.env.DB_URL;
  if (!url) {
    throw new Error(
      "DB_URL missing. Create fixer_backend/config.env with DB_URL=...",
    );
  }
  await mongoose.connect(url);
  console.log("MongoDB connected");
};

const main = async () => {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE: APPLY (float-drift writes only)" : "MODE: DRY-RUN");
  console.log(
    "NOTE: Truncated-discount suspects are REPORT-ONLY and never auto-fixed.",
  );
  console.log("");

  const Repairing = loadRepairingModel();
  await connectDB();

  const cursor = Repairing.find({}).cursor();
  const floatDrift = [];
  const truncatedDiscount = [];
  let scanned = 0;

  for await (const doc of cursor) {
    scanned += 1;
    const lineSubtotal = sumLineTotals(doc);
    const storedSubtotal = toMoney(doc.totalPrice);
    const discount = toMoney(doc.discount);
    const storedPad = toMoney(doc.priceAfterDiscount);
    const expectedPad = round2(storedSubtotal - discount);

    const totalMismatch = Math.abs(lineSubtotal - storedSubtotal) > 0.001;
    const padMismatch = Math.abs(expectedPad - storedPad) > 0.001;

    if (totalMismatch || padMismatch) {
      floatDrift.push({
        _id: String(doc._id),
        genId: doc.genId || "",
        carNumber: doc.carNumber || "",
        totalPrice: storedSubtotal,
        recomputedSubtotal: lineSubtotal,
        discount,
        priceAfterDiscount: storedPad,
        expectedPriceAfterDiscount: expectedPad,
        fixes: {
          ...(totalMismatch ? { totalPrice: lineSubtotal } : {}),
          ...(padMismatch
            ? {
                priceAfterDiscount: round2(
                  (totalMismatch ? lineSubtotal : storedSubtotal) - discount,
                ),
              }
            : {}),
        },
      });
    }

    // Suspected client-side int coercion of discount (e.g. 417.5 → 418).
    // Never auto-fix — operator must confirm suggested discount.
    if (
      hasFractionalPart(storedSubtotal) &&
      isIntegerMoney(discount) &&
      discount > 0 &&
      hasFractionalPart(storedPad)
    ) {
      const suggestedDiscount = round2(
        storedSubtotal - Math.round(storedPad),
      );
      truncatedDiscount.push({
        _id: String(doc._id),
        genId: doc.genId || "",
        carNumber: doc.carNumber || "",
        totalPrice: storedSubtotal,
        discount,
        priceAfterDiscount: storedPad,
        suggestedDiscount,
        note:
          "REPORT-ONLY: re-save repair with suggestedDiscount, or update manually.",
      });
    }
  }

  console.log(`Scanned: ${scanned}`);
  console.log("");
  console.log("=== A) FLOAT-DRIFT (fixable with --apply) ===");
  console.log(`Count: ${floatDrift.length}`);
  for (const row of floatDrift) {
    console.log(JSON.stringify(row, null, 2));
  }

  console.log("");
  console.log(
    "=== B) SUSPECTED TRUNCATED DISCOUNTS (REPORT-ONLY, never auto-fixed) ===",
  );
  console.log(`Count: ${truncatedDiscount.length}`);
  for (const row of truncatedDiscount) {
    console.log(JSON.stringify(row, null, 2));
  }

  if (apply) {
    let updated = 0;
    for (const row of floatDrift) {
      const $set = row.fixes || {};
      if (Object.keys($set).length === 0) continue;
      await Repairing.updateOne({ _id: row._id }, { $set });
      updated += 1;
    }
    console.log(`\nUpdated ${updated} float-drift document(s).`);
    console.log(
      `Truncated-discount suspects left untouched: ${truncatedDiscount.length}`,
    );
  } else {
    console.log("\nDry-run only. Re-run with --apply to write float-drift fixes.");
    console.log(
      "Truncated discounts (section B) are never written by this script.",
    );
  }

  await mongoose.connection.close();
};

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch (_) {}
  process.exit(1);
});
