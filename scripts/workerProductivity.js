const mongoose = require("mongoose");
const Repairing = require("../dist/models/repairingModel");
require("dotenv").config({ path: "config.env" });

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

// Get worker productivity script (completed repairs only)
const getWorkerProductivity = async (startDate, endDate) => {
  try {
    // If no dates provided, use current month
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log(`📊 Worker Productivity Report (Completed Repairs)`);
    console.log(`📅 Period: ${start.toISOString()} to ${end.toISOString()}`);
    console.log(`🔍 Criteria: complete=true AND completedAt IS NOT NULL`);
    console.log(`\n`);

    const workerProductivity = await Repairing.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          complete: true,
          //completedAt: { $ne: null }
        }
      },
      {
        $unwind: {
          path: "$technicians",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            workerId: "$technicians.workerId",
            workerName: "$technicians.name"
          },
          completedRepairs: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          workerId: "$_id.workerId",
          workerName: { $ifNull: ["$_id.workerName", "Unknown Worker"] },
          completedRepairs: 1
        }
      },
      {
        $sort: { completedRepairs: -1 }
      }
    ]);

    if (workerProductivity.length === 0) {
      console.log("❌ No completed repairs found for the specified period");
    } else {
      console.log(`👷‍♂️ Worker Productivity Results:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      let totalRepairs = 0;
      workerProductivity.forEach((worker, index) => {
        totalRepairs += worker.completedRepairs;
        console.log(`${index + 1}. ${worker.workerName} (ID: ${worker.workerId})`);
        console.log(`   ✅ Completed Repairs: ${worker.completedRepairs}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      });

      console.log(`\n📊 Total Completed Repairs: ${totalRepairs}`);
      console.log(`👷‍♂️ Total Workers: ${workerProductivity.length}`);
    }

    return workerProductivity;
  } catch (error) {
    console.error("❌ Error fetching worker productivity:", error.message);
    throw error;
  }
};

// Get all repairs for each worker (both completed and in-progress)
const getAllWorkerRepairs = async (startDate, endDate) => {
  try {
    // If no dates provided, use current month
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log(`📊 All Worker Repairs Report`);
    console.log(`📅 Period: ${start.toISOString()} to ${end.toISOString()}`);
    console.log(`🔍 Criteria: All repairs (completed and in-progress)`);
    console.log(`\n`);

    const allWorkerRepairs = await Repairing.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $unwind: {
          path: "$technicians",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            workerId: "$technicians.workerId",
            workerName: "$technicians.name"
          },
          totalRepairs: { $sum: 1 },
          completedRepairs: {
            $sum: {
              $cond: [
                { $eq: ["$complete", true] },
                // { $and: [, { $ne: ["$completedAt", null] }] },
                1,
                0
              ]
            }
          },
          inProgressRepairs: {
            $sum: {
              $cond: [
                { $eq: ["$complete", false] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          workerId: "$_id.workerId",
          workerName: { $ifNull: ["$_id.workerName", "Unknown Worker"] },
          totalRepairs: 1,
          completedRepairs: 1,
          inProgressRepairs: 1,
          completionRate: {
            $cond: [
              { $gt: ["$totalRepairs", 0] },
              { $multiply: [{ $divide: ["$completedRepairs", "$totalRepairs"] }, 100] },
              0
            ]
          }
        }
      },
      {
        $sort: { totalRepairs: -1 }
      }
    ]);

    if (allWorkerRepairs.length === 0) {
      console.log("❌ No repairs found for the specified period");
    } else {
      console.log(`👷‍♂️ All Worker Repairs Results:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      let totalRepairs = 0;
      let totalCompleted = 0;
      let totalInProgress = 0;
      
      allWorkerRepairs.forEach((worker, index) => {
        totalRepairs += worker.totalRepairs;
        totalCompleted += worker.completedRepairs;
        totalInProgress += worker.inProgressRepairs;
        
        console.log(`${index + 1}. ${worker.workerName} (ID: ${worker.workerId})`);
        console.log(`   📊 Total Repairs: ${worker.totalRepairs}`);
        console.log(`   ✅ Completed: ${worker.completedRepairs}`);
        console.log(`   🔧 In Progress: ${worker.inProgressRepairs}`);
        console.log(`   📈 Completion Rate: ${worker.completionRate.toFixed(1)}%`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      });

      console.log(`\n📊 Total Repairs: ${totalRepairs}`);
      console.log(`✅ Total Completed: ${totalCompleted}`);
      console.log(`🔧 Total In Progress: ${totalInProgress}`);
      console.log(`👷‍♂️ Total Workers: ${allWorkerRepairs.length}`);
    }

    return allWorkerRepairs;
  } catch (error) {
    console.error("❌ Error fetching all worker repairs:", error.message);
    throw error;
  }
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  const reportType = args[0]; // "completed" or "all"
  const startDate = args[1];   // Optional: YYYY-MM-DD format
  const endDate = args[2];     // Optional: YYYY-MM-DD format

  await connectDB();
  console.log(`start date ${startDate} , endDate ${endDate}`)
  await getWorkerProductivity(startDate, endDate);
  // if (reportType === "all") {
  //   await getAllWorkerRepairs(startDate, endDate);
  // } else if (reportType === "completed" || !reportType) {
    
  // } else {
  //   console.log("Usage:");
  //   console.log("  npm run worker:productivity              # Completed repairs only (default)");
  //   console.log("  npm run worker:productivity completed     # Completed repairs only");
  //   console.log("  npm run worker:productivity all           # All repairs (completed + in-progress)");
  //   console.log("  npm run worker:productivity all YYYY-MM-DD     # All repairs with custom start date");
  //   console.log("  npm run worker:productivity all YYYY-MM-DD YYYY-MM-DD  # All repairs with custom date range");
  // }

  await mongoose.connection.close();
  console.log("\n✅ Script completed successfully");
  process.exit(0);
};

// Run the script
main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});