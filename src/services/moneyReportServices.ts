const MonthlyMoneyReport = require("../models/MonthlyMoneyReport");
const Repair = require("../models/repairingModel");
const Worker = require("../models/Worker");
const Inventory = require("../models/Inventory");
//const slugify = require("slugify");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");
const { ObjectId } = require("bson");
const PayrollSnapshot = require("../models/PayrollSnapshot");
const {
  cairoMonthRange,
  cairoDayRange,
  cairoYearMonth,
  cairoPeriod,
  cairoWallTimeToUtc,
  parseCairoDate,
} = require("../utils/cairoTime");

function getUTCDate(year, month) {
  return new Date(Date.UTC(year, month, 1));
}

const periodKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

/**
 * Completed repairs whose income belongs to [year]/[month] (1-12): by the
 * Cairo month they were completed in. Older repairs saved before
 * completedAt existed keep the previous rule (creation month, UTC), so
 * reports for past months come out the same.
 */
const monthIncomeFilter = (year, month) => {
  const { start, end } = cairoMonthRange(year, month);
  return {
    complete: true,
    $or: [
      { completedAt: { $gte: start, $lt: end } },
      {
        completedAt: null,
        createdAt: { $gte: getUTCDate(year, month - 1), $lt: getUTCDate(year, month) },
      },
    ],
  };
};

const liveTotalSalaries = async () => {
  const [row] = await Worker.aggregate([
    { $group: { _id: null, totalSalaries: { $sum: "$salaryAfterProcces" } } },
  ]);
  return row ? row.totalSalaries : 0;
};

/**
 * Salaries for a month: live worker rows for the open month, the month-close
 * snapshot for closed months. A closed month with no snapshot (before
 * snapshots existed) falls back to the live rows, as before.
 */
const totalSalariesFor = async (year, month) => {
  if (periodKey(year, month) === cairoPeriod()) {
    return { total: await liveTotalSalaries(), fromSnapshot: false };
  }
  const snapshot = await PayrollSnapshot.findOne({ period: periodKey(year, month) });
  if (snapshot) return { total: snapshot.totalSalaries || 0, fromSnapshot: true };
  return { total: await liveTotalSalaries(), fromSnapshot: false, estimated: true };
};

export const createReport = asyncHandler(async (req, res, next) => {
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

  if (month < 1 || month > 12) {
    return next(new apiError("month must be between 1 and 12", 400));
  }

  const date = getUTCDate(year, month - 1);
  // Compare whole months (year * 12 + month) in Cairo time, so December of
  // last year counts as a past month.
  const now = cairoYearMonth();
  const requestedIndex = year * 12 + (month - 1);
  const currentIndex = now.year * 12 + (now.month - 1);

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
  if (requestedIndex < currentIndex && oldReport) {
    return res.status(200).json({ data: oldReport });
  } else if (requestedIndex > currentIndex) {
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

    const repairs = await Repair.find(monthIncomeFilter(year, month));

    totalIncome = repairs.reduce(
      (total, repair) => total + (repair.priceAfterDiscount || 0),
      0,
    );

    // totalSalaries هنا أصلاً متضاف/متخصوم منه الـ reward/penalty
    // (لأنها جايه من salaryAfterProcces اللي بيتحسب جوه الـ Worker service)
    // الشهر المقفول بياخد المرتبات من الـ snapshot اللي اتاخد يوم 1
    const { total: totalSalaries } = await totalSalariesFor(year, month);

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
export const getAllReports = factory.getAll(MonthlyMoneyReport);

// @desc put the bills and rent
// @Route put /api/v1/monthlyReport:year_month
// @access private
export const put_the_bills_rent = asyncHandler(async (req, res, next) => {
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
export const addorSubthing = asyncHandler(async (req, res, next) => {
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
export const getmonthWork = asyncHandler(async (req, res, next) => {
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

  // Same repairs the monthly report counts as this month's income.
  const repairs = await Repair.find(monthIncomeFilter(year, month + 1)).select(
    "client brand category model createdAt completedAt priceAfterDiscount",
  );

  const workers = await Worker.find().select("name salary");

  const monthlyReport = await MonthlyMoneyReport.findOne({
    date: {
      $gte: startDate,
      $lt: endDate,
    },
  });

  const additions = monthlyReport ? monthlyReport.additions : [];

  const sortedRepairs = repairs.sort(
    (a, b) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any),
  );

  const sortedWorkers = workers.sort(
    (a, b) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any),
  );

  const sortedAdditions = additions.sort(
    (a, b) => (new Date(b.date) as any) - (new Date(a.date) as any),
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
export const deleteReport = asyncHandler(async (req, res, next) => {
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
export const deleteAddition = asyncHandler(async (req, res, next) => {
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

  // Worker reward/penalty rows are display copies of the worker's record and
  // were never added to the report totals (they're inside salaries).
  if (addition.type === "reward" || addition.type === "penalty") {
    const field = addition.type; // Worker arrays: "reward" / "penalty"
    const worker = await Worker.findOne({ [`${field}._id`]: addition._id });
    const record = worker?.[field]?.id(addition._id);

    // Only an open month's record is removed from the worker; a closed
    // month's pay was already settled, so only the row goes.
    if (worker && record && worker.salaryPeriod === periodKey(year, month + 1)) {
      const amount = Number(record.amount) || 0;
      if (field === "reward") {
        worker.salaryAfterReword = worker.salaryAfterReword - amount;
      }
      worker.salaryAfterProcces = worker.salaryAfterProcces - amount;
      worker[field].pull(record._id);
      await worker.save();

      // This month's salaries changed by -amount; keep the totals in step.
      monthlyReport.outCome -= amount;
      monthlyReport.totalGain += amount;
    }

    monthlyReport.additions.splice(additionIndex, 1);
    await monthlyReport.save();
    return res
      .status(200)
      .json({ data: monthlyReport, message: "Addition deleted successfully" });
  }

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
export const getOrganizationReport = asyncHandler(async (req, res, next) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return next(new apiError("from and to dates are required", 400));
  }

  // "YYYY-MM-DD" dates are Cairo calendar days; the range includes both ends.
  const fromParts = parseCairoDate(from);
  const toParts = parseCairoDate(to);
  if (!fromParts || !toParts) {
    return next(new apiError("from and to must be dates like 2026-10-01", 400));
  }
  const fromDate = cairoWallTimeToUtc(fromParts.year, fromParts.month - 1, fromParts.day);
  const toDate = cairoWallTimeToUtc(toParts.year, toParts.month - 1, toParts.day + 1);
  if (fromDate >= toDate) {
    return next(new apiError("'from' must be on or before 'to'", 400));
  }

  // Today's technician activity, by the Cairo calendar day.
  const { start: todayStart, end: todayEnd } = cairoDayRange();

  // Get all workers (technicians)
  const workers = await Worker.find({}).select("name jobTitle salaryAfterProcces");

  // Get worker repairs for today only
  const todayWorkerRepairs = await Repair.aggregate([
    {
      $match: {
        createdAt: { $gte: todayStart, $lt: todayEnd }
      }
    },
    {
      $unwind: "$technicians"
    },
    {
      $group: {
        _id: "$technicians.workerId",
        totalRepairs: { $sum: 1 },
        completedRepairs: {
          $sum: {
            $cond: [{ $eq: ["$complete", true] }, 1, 0]
          }
        },
        incompleteRepairs: {
          $sum: {
            $cond: [{ $eq: ["$complete", false] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        workerId: "$_id",
        totalRepairs: 1,
        completedRepairs: 1,
        incompleteRepairs: 1
      }
    }
  ]);

  // Add worker names to today's data
  const todayWorkerRepairsWithNames = todayWorkerRepairs.map(worker => {
    const workerInfo = workers.find(w => w._id.toString() === worker.workerId.toString());
    return {
      workerId: worker.workerId,
      workerName: workerInfo?.name || "Unknown Worker",
      totalRepairs: worker.totalRepairs,
      completedRepairs: worker.completedRepairs,
      incompleteRepairs: worker.incompleteRepairs
    };
  });

  // // Count repairs per worker within the date range using technicians array
  // const workersWithRepairCount = await Promise.all(
  //   workers.map(async (worker) => {
  //     const repairCount = await Repair.countDocuments({
  //       technicians: { $elemMatch: { workerId: worker._id } },
  //       createdAt: { $gte: fromDate, $lte: toDate },
  //       complete: true, // Only count completed repairs to match analytics API
  //     });
  //     return {
  //       _id: worker._id,
  //       name: worker.name,
  //       jobTitle: worker.jobTitle,
  //       repairCount: repairCount,
  //       repairLabel: `${repairCount} repairs`,
  //     };
  //   })
  // );

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
    createdAt: { $gte: fromDate, $lt: toDate },
  });

  const totalIncome = repairsInRange.reduce((sum, repair) => {
    return sum + (repair.totalPrice || 0);
  }, 0);

  // Expenses for every month the range touches: that month's salaries
  // (snapshot for closed months) plus its rent and bills.
  let totalExpenses = 0;
  const estimatedSalaryMonths = [];
  for (
    let index = fromParts.year * 12 + (fromParts.month - 1);
    index <= toParts.year * 12 + (toParts.month - 1);
    index++
  ) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    // Months that haven't started yet have no salaries or bills.
    if (periodKey(year, month) > cairoPeriod()) break;
    const salaries = await totalSalariesFor(year, month);
    totalExpenses += salaries.total;
    if (salaries.estimated) estimatedSalaryMonths.push(periodKey(year, month));

    const monthlyReport = await MonthlyMoneyReport.findOne({
      date: getUTCDate(year, month - 1),
    });
    if (monthlyReport) {
      totalExpenses +=
        (monthlyReport.rent || 0) +
        (monthlyReport.electricity_bill || 0) +
        (monthlyReport.water_bill || 0) +
        (monthlyReport.gas_bill || 0);
    }
  }

  const totalGain = totalIncome - totalExpenses;

  res.status(200).json({
    data: {
      range: { from, to },
      technicians: todayWorkerRepairsWithNames,
      //todayWorkerRepairs: todayWorkerRepairsWithNames,
      lowStock: lowStockItems,
      income: totalIncome,
      totalGain: totalGain,
      totalExpenses: totalExpenses,
      // Closed months with no payroll snapshot use current salaries.
      estimatedSalaryMonths,
    },
  });
});

export const updateReport = factory.updateOne(MonthlyMoneyReport);