const MonthlyMoneyReport = require("../models/MonthlyMoneyReport");
const Repair = require("../models/repairingModel");
const Worker = require("../models/Worker");
//const slugify = require("slugify");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");
const { worker } = require("workerpool");

function getUTCDate(year, month) {
  return new Date(Date.UTC(year, month, 1));
}

exports.createReport = asyncHandler(async (req, res, next) => {
  let totalGain = 0;
  const { year, month } = req.body;

  const date = getUTCDate(year, month - 1);

  const oldReport = await MonthlyMoneyReport.findOne({
    date: {
      $gte: date,
      $lt: getUTCDate(year, month),
    },
  });

  if (oldReport) {
    res.status(200).json({ data: oldReport });
  } else {
    const repairs = await Repair.find({
      createdAt: {
        $gte: date,
        $lt: getUTCDate(year, month),
      },
    });

    const totalIncome = repairs.reduce(
      (total, repair) => total + repair.priceAfterDiscount,
      0
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

    const Money = await MonthlyMoneyReport.create({
      date,
      outCome: totalSalaries,
      encome: totalIncome,
      totalGain,
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
        404
      )
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
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const sortedWorkers = workers.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const sortedAdditions = additions.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

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

  res.status(204).send();
});
