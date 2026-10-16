const mongoose = require("mongoose");
require("dotenv").config({ path: "config.env" });

/**
 * Lists duplicate invoice numbers (repairings.genId) and customer codes
 * (cars.generatedCode). With --apply, and only when there are none, adds
 * unique indexes so duplicates can't be created again.
 *
 *   node dist/scripts/checkDuplicateCodes.js           # report only
 *   node dist/scripts/checkDuplicateCodes.js --apply   # report + add indexes
 *
 * Existing documents are never changed.
 */
const CHECKS = [
  { collection: "repairings", field: "genId" },
  { collection: "cars", field: "generatedCode" },
];

async function main() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.DB_URL);
  const db = mongoose.connection.db;
  let anyDuplicates = false;

  for (const { collection, field } of CHECKS) {
    const duplicates = await db
      .collection(collection)
      .aggregate([
        { $match: { [field]: { $type: "string", $ne: "" } } },
        { $group: { _id: `$${field}`, count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    if (duplicates.length === 0) {
      console.log(`${collection}.${field}: no duplicates`);
      if (apply) {
        await db.collection(collection).createIndex(
          { [field]: 1 },
          {
            unique: true,
            name: `${field}_unique`,
            partialFilterExpression: { [field]: { $type: "string" } },
          },
        );
        console.log(`${collection}.${field}: unique index created`);
      }
      continue;
    }

    anyDuplicates = true;
    console.log(`${collection}.${field}: ${duplicates.length} duplicated value(s)`);
    for (const d of duplicates) {
      console.log(`  ${d._id} ×${d.count}: ${d.ids.join(", ")}`);
    }
  }

  if (apply && anyDuplicates) {
    console.log("Indexes were only added where there are no duplicates.");
  }
  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close();
  process.exit(1);
});

export {};
