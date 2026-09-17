/**
 * Read + optional write reconcile for user.password vs car.generatedPassword.
 *
 * Usage:
 *   node -r ts-node/register src/scripts/reconcileUserCarPasswords.ts          # dry-run
 *   node -r ts-node/register src/scripts/reconcileUserCarPasswords.ts --apply  # write
 *
 * Policy: car.generatedPassword is source of truth for garage login codes.
 * loginByCarCode authenticates against user.password — they must match.
 */
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../../config.env") });

const apply = process.argv.includes("--apply");

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
  let mismatched = 0;
  let fixed = 0;
  let missingCar = 0;
  let emptyCar = 0;

  const cursor = users.find({}).project({ password: 1, car: 1, name: 1, email: 1 });
  for await (const u of cursor) {
    const carEntries = Array.isArray(u.car) ? u.car : [];
    if (carEntries.length === 0) {
      emptyCar++;
      continue;
    }
    for (const entry of carEntries) {
      const code = entry?.carCode;
      if (!code) continue;
      checked++;
      const car = await cars.findOne(
        { generatedCode: code },
        { projection: { generatedPassword: 1, generatedCode: 1 } },
      );
      if (!car) {
        missingCar++;
        console.log(`MISSING_CAR user=${u._id} code=${code}`);
        continue;
      }
      if (String(car.generatedPassword ?? "") === String(u.password ?? "")) {
        continue;
      }
      mismatched++;
      console.log(
        `MISMATCH user=${u._id} code=${code} (syncing user.password ← car.generatedPassword)`,
      );
      if (apply) {
        await users.updateOne(
          { _id: u._id },
          { $set: { password: car.generatedPassword } },
        );
        fixed++;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        checked,
        mismatched,
        fixed,
        missingCar,
        usersWithEmptyCar: emptyCar,
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
