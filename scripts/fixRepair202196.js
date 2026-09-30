// One-off repair for genId 202196 (car 1383 - ق ف د): all 14 services are
// completed but a concurrent update left complete=false / ratio=13/14.
// Run from fixer_backend/:  node scripts/fixRepair202196.js
require("dotenv").config({ path: "config.env" });
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.DB_URL);
  const db = mongoose.connection.db;
  const id = new mongoose.Types.ObjectId("6abd140a5ff1a5e4ef03a0e3");

  const r = await db.collection("repairings").findOne({ _id: id });
  if (!r || r.complete || !r.Services.every((s) => s.state === "completed")) {
    console.log("Repair is not in the broken state, nothing to do.");
    return mongoose.disconnect();
  }
  const car = await db.collection("cars").findOne({ _id: r.carId });
  const doneAt = r.updatedAt; // time of the last service tick
  const State =
    car.nextRepairDate && new Date() >= new Date(car.nextRepairDate)
      ? "Need to check"
      : "Good";

  const r1 = await db.collection("repairings").updateOne(
    { _id: id, complete: false },
    { $set: { complete: true, completedServicesRatio: 1, completedAt: doneAt } },
  );
  const r2 = await db.collection("cars").updateOne(
    { _id: r.carId, repairing_id: id },
    {
      $set: { State, repairing: false, completedServicesRatio: 1, lastRepairDate: doneAt },
      $unset: { repairing_id: "" },
    },
  );
  console.log("repair modified:", r1.modifiedCount, "| car modified:", r2.modifiedCount, "| car State:", State);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
