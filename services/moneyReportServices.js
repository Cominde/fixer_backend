const MonthlyMoneyReport = require("../models/MonthlyMoneyReport");
const Repair = require("../models/repairingModel");
const Worker = require("../models/Worker");
const Inventory = require("../models/Inventory");
//const slugify = require("slugify");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");
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

  // تحويل صريح لأرقام - عشان نضمن إن المقارنات الصارمة (===) مع
  // rewardMonth/rewardYear (اللي هي أرقام دايمًا) متفشلش لو الـ request
  // جاي بـ month/year كـ string (فرق شائع بين postman/local وclient حقيقي)
  const year = Number(req.body.year);
  const month = Number(req.body.month);

  if (Number.isNaN(year) || Number.isNaN(month)) {
    return next(new apiError("year and month must be valid numbers", 400));
  }

  const date = getUTCDate(year, month - 1);
  const currentDate = new Date();

  const oldReport = await MonthlyMoneyReport.findOne({
    date: {
      $gte: date,
      $lt: getUTCDate(year, month),
    },
  });

  if (oldReport) {
    if (oldReport.rent) rent = oldReport.rent;
    if (oldReport.electricity_bill) electricity_bill = oldReport.electricity_bill;
    if (oldReport.water_bill) water_bill = oldReport.water_bill;
    if (oldReport.gas_bill) gas_bill = oldReport.gas_bill;

    // خد الإضافات اليدوية بس (استثني reward/penalty)
    // لأن reward/penalty هيتبنوا من جديد تحت من مصدرهم الحقيقي (Worker collection)
    if (oldReport.additions && oldReport.additions.length > 0) {
      additions = oldReport.additions.filter(
        (a) => a.type !== 'reward' && a.type !== 'penalty'
      );
    }
  }

  // ملحوظة: استخدمنا getUTCMonth/getUTCFullYear بدل getMonth/getFullYear
  // عشان الحساب يبقى ثابت مهما كان الـ timezone بتاع السيرفر (local vs Render/UTC)
  if (
    (currentDate.getUTCMonth() > date.getUTCMonth() ||
      currentDate.getUTCFullYear() > date.getUTCFullYear()) &&
    oldReport
  ) {
    return res.status(200).json({ data: oldReport });
  } else if (
    currentDate.getUTCMonth() < date.getUTCMonth() ||
    currentDate.getUTCFullYear() < date.getUTCFullYear()
  ) {
    return next(
      new apiError(
        "the date that you enter will coming soon , if we live",
        400,
      ),
    );
  } else {
    await MonthlyMoneyReport.findOneAndDelete({
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
      complete:true
    });

    totalIncome = repairs.reduce(
      (total, repair) => total + repair.priceAfterDiscount,
      0,
    );

    // totalSalaries هنا أصلاً متضاف/متخصوم منه الـ reward/penalty
    // (لأنها جايه من salaryAfterProcces اللي بيتحسب جوه الـ Worker service)
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
      totaloutcome += rent;
      totalGain -= rent;
    }
    if (electricity_bill) {
      totaloutcome += electricity_bill;
      totalGain -= electricity_bill;
    }
    if (water_bill) {
      totaloutcome += water_bill;
      totalGain -= water_bill;
    }
    if (gas_bill) {
      totaloutcome += gas_bill;
      totalGain -= gas_bill;
    }

    // اجمع reward/penalty بتاعة الشهر ده - عشان تتسجل في additions للعرض فقط
    // من غير ما تأثر على التوتالز لأنها أصلاً محسوبة جوه totalSalaries
    const workerRewardsPenalties = await Worker.aggregate([
      {
        $match: {
          $or: [
            { 'reward.date': { $exists: true } },
            { 'penalty.date': { $exists: true } },
          ],
        },
      },
      {
        $project: {
          name: 1,
          reward: 1,
          penalty: 1,
        },
      },
    ]);

    for (const worker of workerRewardsPenalties) {
      for (const reward of worker.reward || []) {
        const rewardDate = new Date(reward.date);
        // getUTCMonth/getUTCFullYear بدل getMonth/getFullYear
        // عشان نتجنب فرق التوقيت بين local وRender
        const rewardMonth = rewardDate.getUTCMonth() + 1;
        const rewardYear = rewardDate.getUTCFullYear();

        if (rewardMonth === month && rewardYear === year) {
          additions.push({
            title: `Worker Reward - ${worker.name}`,
            price: -reward.amount,
            date: reward.date,
            type: 'reward',
            _id: new ObjectId(reward._id),
          });
        }
      }

      for (const penalty of worker.penalty || []) {
        const penaltyDate = new Date(penalty.date);
        const penaltyMonth = penaltyDate.getUTCMonth() + 1;
        const penaltyYear = penaltyDate.getUTCFullYear();

        if (penaltyMonth === month && penaltyYear === year) {
          additions.push({
            title: `Worker Penalty - ${worker.name}`,
            price: Math.abs(penalty.amount),
            date: penalty.date,
            type: 'penalty',
            _id: new ObjectId(penalty._id),
          });
        }
      }
    }

    // احسب التوتالز بس من الإضافات اليدوية (استثني reward/penalty
    // لأنها أصلاً متحسوبة جوه totalSalaries)
    for (const addition of additions) {
      if (addition.type === 'reward' || addition.type === 'penalty') {
        continue; // اتحسبت أصلاً جوه salaryAfterProcces
      }
      if (addition.price < 0) {
        totaloutcome -= addition.price;
        totalGain += addition.price;
      } else {
        totalIncome += addition.price;
        totalGain += addition.price;
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
    (a, b) => new Date(b.date) - new Date(a.date),
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