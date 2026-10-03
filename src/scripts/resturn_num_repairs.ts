const mongoose = require("mongoose");
const Repairing = require("../models/repairingModel");
const Worker = require("../models/Worker");
require("dotenv").config({ path: "config.env" });

mongoose.connect(process.env.DB_URL).then(() => {
  console.log("DB connection successful");
});

async function updateNextRepairDistance() {
  try {
    const workers = await Worker.find({}).select("_id name numberOfRepairs");

    // Get worker repairs for today only
    const todayWorkerRepairs = await Repairing.aggregate([
      {
        $unwind: "$technicians",
      },
      {
        $group: {
          _id: "$technicians.workerId",
          numberOfRepairs: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          workerId: "$_id",
          numberOfRepairs: 1,
        },
      },
    ]);

    // Add worker names to today's data
    let counter = 0;
    for (const worker of todayWorkerRepairs) {
      if (worker.workerId) {
        const _ = await Worker.findByIdAndUpdate(worker.workerId, {
          numberOfRepairs: worker.numberOfRepairs,
        });
      }
      counter++;
    }
    console.log(counter);
    console.log(`\n🎉 Successfully updated ${counter} workers`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error in updateNextRepairDistance script:", error);
    process.exit(1);
  }
}

updateNextRepairDistance();

export {};
