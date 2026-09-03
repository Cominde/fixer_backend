const MonthlyMoneyReport = require("../models/MonthlyMoneyReport");
const Repair = require("../models/repairingModel");
const Worker = require("../models/Worker");
const Inventory = require("../models/Inventory");
//const slugify = require("slugify");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");
const { worker } = require("workerpool");
const { ObjectId } = require("bson");

function getUTCDate(year, month) {
  return new Date(Date.UTC(year, month, 1));
}

exports.createReport = asyncHandler(async (req, res, next) => {
  let totalGain = 0;
  let totaloutcome = 0;
  let totalIncome = 0;
  let rent = undefined;
  let electricity_bill = undefined;
  let water_bill = undefined;
  let gas_bill = undefined;
  let additions = [];
  let rewards_and_pen = [];

  const { year, month } = req.body;

  const date = getUTCDate(year, month - 1);
  const currentDate = new Date();

  const oldReport = await MonthlyMoneyReport.findOne({
    date: {
      $gte: date,
      $lt: getUTCDate(year, month),
    },
  });

  if (oldReport) {
    if (oldReport.rent) {
      rent = oldReport.rent;
    }
    if (oldReport.electricity_bill) {
      electricity_bill = oldReport.electricity_bill;
    }
    if (oldReport.water_bill) {
      water_bill = oldReport.water_bill;
    }
    if (oldReport.gas_bill) {
      gas_bill = oldReport.gas_bill;
    }
    if (oldReport.additions) {
      additions = oldReport.additions;
    }
  }

  if (
    (currentDate.getMonth() > date.getMonth() ||
      currentDate.getFullYear() > date.getFullYear()) &&
    oldReport
  ) {
    res.status(200).json({ data: oldReport });
  } else if (
    currentDate.getMonth() < date.getMonth() ||
    currentDate.getFullYear() < date.getFullYear()
  ) {
    return next(
      new apiError(
        "the date that you enter will coming soon , if we live",
        400,
      ),
    );
  } else {
    let monthlyReport = await MonthlyMoneyReport.findOneAndDelete({
      date: {
        $gte: date,
        $lt: getUTCDate(year, month),
      },
    });

    const repairs = await Repair.find({
      createdAt: {
        $gte: date,
        $lt: getUTCDate(year, month),
      },
    });

    totalIncome = repairs.reduce(
      (total, repair) => total + repair.priceAfterDiscount,
      0,
    );

    const salariesAggregate = await Worker.aggregate([
      {
        $group: {
          _id: null,
          totalSalaries: { $sum: "$salaryAfterProcces" },
        },
      },
    ]);

    const totalSalaries =
      salariesAggregate.length > 0 ? salariesAggregate[0].totalSalaries : 0;

    totalGain = totalIncome - totalSalaries;
    totaloutcome = totalSalaries;

    if (rent) {
      totaloutcome = totaloutcome + rent;
      totalGain = totalGain - rent;
    }

    if (electricity_bill) {
      totaloutcome = totaloutcome + electricity_bill;
      totalGain = totalGain - electricity_bill;
    }

    if (water_bill) {
      totaloutcome = totaloutcome + water_bill;
      totalGain = totalGain - water_bill;
    }

    if (gas_bill) {
      totaloutcome = totaloutcome + gas_bill;
      totalGain = totalGain - gas_bill;
    } 


    if (additions.length > 0) {
      for (let i = 0; i < additions.length; i++) {
        if (additions[i].price < 0) {
          totaloutcome = totaloutcome - additions[i].price;
          totalGain = totalGain + additions[i].price;
        } else {
          totalIncome = totalIncome + additions[i].price;
          totalGain = totalGain + additions[i].price;
        }
        if(additions[i].type !=null){
          rewards_and_pen.push(additions[i])
        }
      }
    }

    // Add worker rewards as outcomes if they match the report's month/year
    // Use aggregation for better performance
    const workerRewardsPenalties = await Worker.aggregate([
      {
        $match: {
          $or: [
            { 'reward.date': { $exists: true } },
            { 'penalty.date': { $exists: true } }
          ]
        }
      },
      {
        $project: {
          name: 1,
          reward: 1,
          penalty: 1
        }
      }
    ]);


      for (const worker of workerRewardsPenalties) {
        for (const reward of worker.reward || []) {
          const rewardDate = new Date(reward.date);
          const rewardMonth = rewardDate.getMonth() + 1;
          const rewardYear = rewardDate.getFullYear();

          if (rewardMonth === month && rewardYear === year) {
            const alreadyExists = rewards_and_pen.some(
              (re) => re.type === 'reward' && re._id && re._id.equals(reward._id)
            );

            if (alreadyExists) {
              continue;
            }
            additions.push({
              title: `Worker Reward - ${worker.name}`,
              price: - reward.amount,
              date: reward.date,
              type: 'reward',
              _id: new ObjectId(reward._id),
            });
          }
        }

      // Process penalties
      for (const penalty of worker.penalty || []) {
        const penaltyDate = new Date(penalty.date);
        const penaltyMonth = penaltyDate.getMonth() + 1;
        const penaltyYear = penaltyDate.getFullYear();

        if (penaltyMonth === month && penaltyYear === year) {
            const alreadyExists = rewards_and_pen.some(
              (pen) => pen.type === 'penalty' && pen._id && pen._id.equals(penalty._id)
            );

            if (alreadyExists) {
              continue;
            }
            additions.push({
            title: `Worker Penalty - ${worker.name}`,
            price: Math.abs(penalty.amount),
            date: penalty.date,
            _id: new ObjectId(penalty._id),
            type:'penalty',
              });
              }
            }
      }

    const Money = await MonthlyMoneyReport.create({
      date,
      outCome: totaloutcome,
      encome: totalIncome,
      totalGain,
      electricity_bill,
      water_bill,
      gas_bill,
      rent,
      additions,
    });

    if (!Money) {
      return next(new apiError("There was an error in report creation", 400));
    }

    res.status(201).json({ data: Money });
  }
});

// @desc get all a monthly Report
// @Route get /api/v1/monthlyReport
// @access private
exports.getAllReports = factory.getAll(MonthlyMoneyReport);

// @desc put the bills and rent
// @Route put /api/v1/monthlyReport:year_month
// @access private
exports.put_the_bills_rent = asyncHandler(async (req, res, next) => {
  let { year_month } = req.params;
  const { electricity_bill, water_bill, gas_bill, rent } = req.body;
  let total_bills = 0;

  if (
    (electricity_bill !== undefined && electricity_bill < 0) ||
    (water_bill !== undefined && water_bill < 0) ||
    (gas_bill !== undefined && gas_bill < 0) ||
    (rent !== undefined && rent < 0)
  ) {
    return next(new apiError("The values must be positive", 400));
  }

  let [year, month] = year_month.split("_").map(Number);
  if (isNaN(month) || isNaN(year)) {
    return next(new apiError("Invalid month and year", 400));
  }

  const report = await MonthlyMoneyReport.findOne({
    $expr: {
      $and: [
        { $eq: [{ $year: "$date" }, year] },
        { $eq: [{ $month: "$date" }, month] },
      ],
    },
  });

  if (!report) {
    return next(new apiError(`No report found for ${month}/${year}`, 404));
  }

  // Update only the fields that are provided
  if (electricity_bill !== undefined) {
    total_bills += electricity_bill - (report.electricity_bill || 0);
    report.electricity_bill = electricity_bill;
  }

  if (water_bill !== undefined) {
    total_bills += water_bill - (report.water_bill || 0);
    report.water_bill = water_bill;
  }

  if (gas_bill !== undefined) {
    total_bills += gas_bill - (report.gas_bill || 0);
    report.gas_bill = gas_bill;
  }

  if (rent !== undefined) {
    total_bills += rent - (report.rent || 0);
    report.rent = rent;
  }

  report.outCome += total_bills;
  report.totalGain -= total_bills;

  await report.save();

  res.status(200).json({ data: report });
});

// @desc add  additions
// @Route post /api/v1/monthlyReport/addthing
// @access private
exports.addorSubthing = asyncHandler(async (req, res, next) => {
  const { date, price, title } = req.body;
  let posPrice = 0;

  const month = new Date(date).getMonth();
  const year = new Date(date).getFullYear();

  const dateM = getUTCDate(year, month);

  let monthlyReport = await MonthlyMoneyReport.findOne({ date: dateM });

  if (!monthlyReport) {
    return next(
      new apiError(
        `There is no report for this month ${month + 1} and this year ${year}`,
        404,
      ),
    );
  }

  monthlyReport.additions.push({ title, price, date });

  if (price > 0) {
    monthlyReport.encome += price;
    monthlyReport.totalGain += price;
  } else {
    posPrice = price * -1;
    monthlyReport.outCome += posPrice;
    monthlyReport.totalGain -= posPrice;
  }

  await monthlyReport.save();

  res.status(200).json({ data: monthlyReport });
});

// @desc get all repair of the month
// @Route post /api/v1/monthlyReport/repairs
// @access private
exports.getmonthWork = asyncHandler(async (req, res, next) => {
  let { year_month } = req.params;

  let [year, month] = year_month.split("_").map(Number);
  month = parseInt(month) - 1; // Adjust month to zero-based index
  year = parseInt(year);

  if (isNaN(month) || isNaN(year)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid month or year" });
  }

  const startDate = getUTCDate(year, month);
  const endDate = getUTCDate(year, month + 1);

  const repairs = await Repair.find({
    createdAt: {
      $gte: startDate,
      $lt: endDate,
    },
  }).select("client brand category model createdAt priceAfterDiscount");

  const workers = await Worker.find().select("name salary");

  const monthlyReport = await MonthlyMoneyReport.findOne({
    date: {
      $gte: startDate,
      $lt: endDate,
    },
  });

  const additions = monthlyReport ? monthlyReport.additions : [];

  const sortedRepairs = repairs.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  const sortedWorkers = workers.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  const sortedAdditions = additions.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  if (monthlyReport) {
    if (monthlyReport.rent) {
      sortedAdditions.push({
        title: "rent",
        date: null,
        price: monthlyReport.rent,
      });
    }

    if (monthlyReport.electricity_bill) {
      sortedAdditions.push({
        title: "Electricity bill",
        date: null,
        price: monthlyReport.electricity_bill,
      });
    }

    if (monthlyReport.water_bill) {
      sortedAdditions.push({
        title: "Water bill",
        date: null,
        price: monthlyReport.water_bill,
      });
    }

    if (monthlyReport.gas_bill) {
      sortedAdditions.push({
        title: "Gas bill",
        date: null,
        price: monthlyReport.gas_bill,
      });
    }
  }

  // Add worker rewards as outcomes if they match the report's month/year
  // Use aggregation for better performance
  const rewards_pen_ofworkers = await Worker.aggregate([
    {
      $match: {
        $or: [
          { 'reward.date': { $exists: true } },
          { 'penalty.date': { $exists: true } }
        ]
      }
    },
    {
      $project: {
        name: 1,
        reward: 1,
        penalty: 1
      }
    }
  ]);

  // Track added items to prevent duplicates
  const addedItems = new Set();

  // Also track existing additions to prevent duplicates
  const existingAdditionKeys = new Set();
  for (const add of additions) {
    if (add.title && add.title.startsWith('Worker Reward -')) {
      existingAdditionKeys.add(`reward_${add.date}_${add.price}`);
    } else if (add.title && add.title.startsWith('Worker Penalty -')) {
      existingAdditionKeys.add(`penalty_${add.date}_${add.price}`);
    }
  }

  for (const worker of rewards_pen_ofworkers) {
    // Process rewards
    for (const reward of worker.reward || []) {
      const rewardDate = new Date(reward.date);
      const rewardMonth = rewardDate.getMonth() + 1;
      const rewardYear = rewardDate.getFullYear();
      const rewardKey = `reward_${reward.date}_${reward.amount}`;

      if (rewardMonth === month && rewardYear === year && 
          !addedItems.has(rewardKey) && !existingAdditionKeys.has(rewardKey)) {
        addedItems.add(rewardKey);
        sortedAdditions.push({
          title: `Worker Reward - ${worker.name}`,
          price: -reward.amount,
          date: reward.date,
        });
      }
    }

    // Process penalties
    for (const penalty of worker.penalty || []) {
      const penaltyDate = new Date(penalty.date);
      const penaltyMonth = penaltyDate.getMonth() + 1;
      const penaltyYear = penaltyDate.getFullYear();
      const penaltyKey = `penalty_${penalty.date}_${Math.abs(penalty.amount)}`;

      if (penaltyMonth === month && penaltyYear === year && 
          !addedItems.has(penaltyKey) && !existingAdditionKeys.has(penaltyKey)) {
        addedItems.add(penaltyKey);
        sortedAdditions.push({
          title: `Worker Penalty - ${worker.name}`,
          price: -Math.abs(penalty.amount),
          date: penalty.date,
        });
      }
    }
  }

  res
    .status(200)
    .json({ data: { sortedRepairs, sortedWorkers, sortedAdditions } });
});

// @desc delete  report
// @Route delete /api/v1/monthlyReport/delete
// @access private
exports.deleteReport = asyncHandler(async (req, res, next) => {
  let { year_month } = req.params;

  let [year, month] = year_month.split("_").map(Number);
  month = parseInt(month) - 1; // Adjust month to zero-based index
  year = parseInt(year);

  const dateM = getUTCDate(year, month);

  let monthlyReport = await MonthlyMoneyReport.findOneAndDelete({
    date: dateM,
  });

  if (!monthlyReport) {
    return next(new apiError(`No Report for this date ${dateM}`, 404));
  }

  res.status(200).json({ message: "Report deleted successfully" });
});

// @desc delete specific addition from monthly report
// @Route delete /api/v1/monthlyReport/addition/:year_month/:additionId
// @access private
exports.deleteAddition = asyncHandler(async (req, res, next) => {
  let { year_month, additionId } = req.params;

  let [year, month] = year_month.split("_").map(Number);
  month = parseInt(month) - 1; // Adjust month to zero-based index
  year = parseInt(year);

  const dateM = getUTCDate(year, month);

  let monthlyReport = await MonthlyMoneyReport.findOne({
    date: dateM,
  });

  if (!monthlyReport) {
    return next(new apiError(`No Report for this date ${dateM}`, 404));
  }

  const additionIndex = monthlyReport.additions.findIndex(
    (add) => add._id.toString() === additionId
  );

  if (additionIndex === -1) {
    return next(new apiError(`Addition not found`, 404));
  }

  const addition = monthlyReport.additions[additionIndex];

  // Reverse the financial impact
  if (addition.price > 0) {
    monthlyReport.encome -= addition.price;
    monthlyReport.totalGain -= addition.price;
  } else {
    const posPrice = addition.price * -1;
    monthlyReport.outCome -= posPrice;
    monthlyReport.totalGain += posPrice;
  }

  // Remove the addition
  monthlyReport.additions.splice(additionIndex, 1);

  await monthlyReport.save();

  res.status(200).json({ data: monthlyReport, message: "Addition deleted successfully" });
});

// @desc get organization report data
// @Route get /api/V1/MonthlyReport/organization
// @access private (admin)
exports.getOrganizationReport = asyncHandler(async (req, res, next) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return next(new apiError("from and to dates are required", 400));
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  // Get all workers (technicians)
  const workers = await Worker.find({}).select("name jobTitle");

  // Count repairs per worker within the date range using technicians array
  const workersWithRepairCount = await Promise.all(
    workers.map(async (worker) => {
      const repairCount = await Repair.countDocuments({
        technicians: { $elemMatch: { workerId: worker._id } },
        createdAt: { $gte: fromDate, $lte: toDate },
      });
      return {
        _id: worker._id,
        name: worker.name,
        jobTitle: worker.jobTitle,
        repairCount: repairCount,
        repairLabel: `${repairCount} repairs`,
      };
    })
  );

  // Get low stock inventory items
  const inventoryItems = await Inventory.find({});
  const lowStockItems = inventoryItems
    .filter((item) => item.quantity <= item.alertQuantity)
    .map((item) => ({
      _id: item._id,
      name: item.name,
      quantity: item.quantity,
      alertQuantity: item.alertQuantity,
      isLowStock: true,
    }));

  // Calculate monthly income and gain for the date range
  const repairsInRange = await Repair.find({
    createdAt: { $gte: fromDate, $lte: toDate },
  });

  const totalIncome = repairsInRange.reduce((sum, repair) => {
    return sum + (repair.totalPrice || 0);
  }, 0);

  // Get workers' salaries for the period
  const totalSalaries = workers.reduce((sum, worker) => {
    return sum + (worker.salary || 0);
  }, 0);

  // Get monthly report for the period (if exists)
  const monthlyReport = await MonthlyMoneyReport.findOne({
    date: { $gte: fromDate, $lte: toDate },
  });

  let totalExpenses = totalSalaries;
  if (monthlyReport) {
    if (monthlyReport.rent) totalExpenses += monthlyReport.rent;
    if (monthlyReport.electricity_bill) totalExpenses += monthlyReport.electricity_bill;
    if (monthlyReport.water_bill) totalExpenses += monthlyReport.water_bill;
    if (monthlyReport.gas_bill) totalExpenses += monthlyReport.gas_bill;
    if (monthlyReport.bills) totalExpenses += monthlyReport.bills;
  }

  const totalGain = totalIncome - totalExpenses;

  res.status(200).json({
    data: {
      range: { from, to },
      technicians: workersWithRepairCount,
      lowStock: lowStockItems,
      income: totalIncome,
      totalGain: totalGain,
      totalExpenses: totalExpenses,
    },
  });
});

exports.updateReport = factory.updateOne(MonthlyMoneyReport);