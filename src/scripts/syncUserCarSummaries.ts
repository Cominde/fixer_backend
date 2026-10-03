/**
 * Read + optional write sync of user.car[] summaries from the Car documents.
 *
 * Usage:
 *   node -r ts-node/register src/scripts/syncUserCarSummaries.ts          # dry-run
 *   node -r ts-node/register src/scripts/syncUserCarSummaries.ts --apply  # write
 *
 * Policy: the Car document is source of truth. updateCar used to skip the
 * embedded copy, so an edited carNumber/brand/category/model drifted and
 * broke loginByCarCode (it looked the car up by the stale carNumber).
 */
export {};
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../../config.env") });

const apply = process.argv.includes("--apply");
const FIELDS = ["carNumber", "brand", "category", "model"];

(async () => {
  const uri = process.env.DB_URL;
  if (!uri) {
    console.error("DB_URL missing");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const users = db.collection("users");
  const cars = db.collection("cars");

  let checked = 0;
  let drifted = 0;
  let fixed = 0;
  let missingCar = 0;

  const cursor = users.find({ "car.0": { $exists: true } }).project({ car: 1, name: 1 });
  for await (const u of cursor) {
    for (const entry of u.car) {
      if (!entry?.carCode) continue;
      checked++;
      const car =
        (await cars.findOne({ generatedCode: entry.carCode })) ||
        (entry.id ? await cars.findOne({ _id: entry.id }) : null);
      if (!car) {
        missingCar++;
        console.log(`MISSING_CAR user=${u._id} code=${entry.carCode}`);
        continue;
      }
      const diff = FIELDS.filter((f) => String(car[f] ?? "") !== String(entry[f] ?? ""));
      if (diff.length === 0) continue;
      drifted++;
      console.log(
        `DRIFT user=${u._id} name=${u.name} code=${entry.carCode} ` +
          diff.map((f) => `${f}: "${entry[f]}" -> "${car[f]}"`).join(" | "),
      );
      if (apply) {
        const set: any = { "car.$.id": car._id };
        for (const f of FIELDS) set[`car.$.${f}`] = car[f];
        await users.updateOne({ _id: u._id, "car.carCode": entry.carCode }, { $set: set });
        fixed++;
      }
    }
  }

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", checked, drifted, fixed, missingCar }, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
