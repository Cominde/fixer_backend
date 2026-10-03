const mongoose = require("mongoose");
const Repairing = require("../models/repairingModel");
const Worker = require("../models/Worker");
require("dotenv").config({ path: "config.env" });

async function setMonthlyRepairCounts() {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("✅ DB connection successful");

    // Get current month's date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log(`📊 Setting monthly repair counts for ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`);
    console.log(`📅 Period: ${startOfMonth.toISOString()} to ${endOfMonth.toISOString()}`);

    // Get all workers
    const workers = await Worker.find({}).select("_id name monthlyRepairs");
    console.log(`👷‍♂️ Found ${workers.length} workers`);

    // Count completed repairs for each worker in the current month
    const workerMonthlyRepairs = await Repairing.aggregate([
      {
        $match: {
          complete: true,
          completedAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $unwind: "$technicians",
      },
      {
        $group: {
          _id: "$technicians.workerId",
          monthlyRepairs: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          workerId: "$_id",
          monthlyRepairs: 1,
        },
      },
    ]);

    console.log(`📊 Found repair counts for ${workerMonthlyRepairs.length} workers in current month`);

    // Update each worker with their monthly repair count
    let updatedCount = 0;
    for (const workerRepair of workerMonthlyRepairs) {
      if (workerRepair.workerId) {
        const result = await Worker.findByIdAndUpdate(
          workerRepair.workerId,
          { monthlyRepairs: workerRepair.monthlyRepairs },
          { new: true }
        );
        if (result) {
          console.log(`✅ Updated ${result.name}: ${result.monthlyRepairs} repairs this month`);
          updatedCount++;
        }
      }
    }

    // Set monthlyRepairs to 0 for workers with no repairs this month
    const workerIdsWithRepairs = workerMonthlyRepairs
      .map((wr) => wr.workerId?.toString())
      .filter(Boolean);

    for (const worker of workers) {
      if (!workerIdsWithRepairs.includes(worker._id.toString())) {
        await Worker.findByIdAndUpdate(worker._id, { monthlyRepairs: 0 });
        console.log(`✅ Updated ${worker.name}: 0 repairs this month (no repairs found)`);
        updatedCount++;
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} workers with monthly repair counts`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error in setMonthlyRepairCounts script:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

setMonthlyRepairCounts();

export {};
