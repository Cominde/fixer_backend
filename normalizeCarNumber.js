require("dotenv").config({ path: "./config.env" });

const mongoose = require("mongoose");
const { normalizeCarNumber } = require("./utils/carNumberCheck");

const Repairing = require("./models/repairingModel");
const Car = require("./models/Car");
const User = require("./models/userModel");

const cleanDatabase = async () => {
  await mongoose.connect(process.env.DB_URL);
  console.log("✅ Connected to DB\n");

  // ── 1. Clean Repairing collection ──────────────────────────
  console.log("Cleaning Repairing collection...");
  const repairs = await Repairing.find({ carNumber: { $exists: true } });
  let fixedRepairs = 0;
  for (const doc of repairs) {
    const cleaned = normalizeCarNumber(doc.carNumber);
    if (cleaned !== doc.carNumber) {
      await Repairing.updateOne(
        { _id: doc._id },
        { $set: { carNumber: cleaned } },
      );
      console.log(`  ✅ "${doc.carNumber}" → "${cleaned}"`);
      fixedRepairs++;
    }
  }
  console.log(`Repairing: fixed ${fixedRepairs}/${repairs.length}\n`);

  // ── 2. Clean Car collection ─────────────────────────────────
  console.log("Cleaning Car collection...");
  const cars = await Car.find({ carNumber: { $exists: true } });
  let fixedCars = 0;
  for (const doc of cars) {
    const cleaned = normalizeCarNumber(doc.carNumber);
    if (cleaned !== doc.carNumber) {
      await Car.updateOne({ _id: doc._id }, { $set: { carNumber: cleaned } });
      console.log(`  ✅ "${doc.carNumber}" → "${cleaned}"`);
      fixedCars++;
    }
  }
  console.log(`Car: fixed ${fixedCars}/${cars.length}\n`);

  // ── 3. Clean User collection (car array inside user) ────────
  console.log("Cleaning User.car array...");
  const users = await User.find({ "car.carNumber": { $exists: true } }); // "car" not "cars"
  let fixedUsers = 0;
  for (const user of users) {
    let modified = false;
    for (const car of user.car) {
      if (!car.carNumber) continue;
      const cleaned = normalizeCarNumber(car.carNumber);
      if (cleaned !== car.carNumber) {
        console.log(`  ✅ User ${user._id}: "${car.carNumber}" → "${cleaned}"`);
        car.carNumber = cleaned;
        modified = true;
      }
    }
    if (modified) {
      await user.save();
      fixedUsers++;
    }
  }
  console.log(`Users with fixed cars: ${fixedUsers}/${users.length}\n`);

  await mongoose.disconnect();
  console.log("✅ All done! Database is clean.");
};

cleanDatabase().catch(console.error);
