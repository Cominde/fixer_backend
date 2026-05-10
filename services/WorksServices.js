const Worker = require("../models/Worker");
//const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");
const moment = require("moment");
const ApiFeatures = require("../utils/apiFeatures");
const searchService = require("./searchService");
// @desc add Worker
// @Route post /api/v1/Worker
// @access private
exports.addWorker = asyncHandler(async (req, res) => {
  const { name, phoneNumber, jobTitle, salary, IdNumber } = req.body;

  const newDoc = await Worker.create({
    name,
    phoneNumber,
    jobTitle,
    salary,
    IdNumber,
    salaryAfterProcces: salary,
    salaryAfterReword: salary,
  });
  res.status(201).json({ data: newDoc });
});

// @desc Get list of Worker
// @Route GET /api/v1/Worker
// @access private
exports.getAllWorkers = factory.getAll(Worker);

// @desc Get spacific Worker
// @Route GET /api/v1/Worker
// @access private
exports.searchForWorker = asyncHandler(async (req, res, next) => {
  const { searchString } = req.params;
  const { documents, paginationResult } = await searchService({
    Model: Worker,
    searchString,
    select: "name IdNumber phoneNumber jobTitle salary salaryAfterProcces",
  });
  if (!documents || documents.length === 0) {
    return next(
      new apiError(
        `No document found for the search string ${searchString}`,
        404,
      ),
    );
  }

  res.status(200).json({
    results: documents.length,
    paginationResult,
    data: documents,
  });
});

// @desc get spacific Worker
// @Route GET /api/v1/Worker
// @access private
exports.getSpacificWorker = factory.getOne(Worker);

// @desc Update spacific Worker
// @Route Put /api/v1/Worker
// @access private
exports.UpdateWorkerDetals = factory.updateOne(Worker);

// @desc delte Worker
// @Route DELTE /api/v1/Worker
// @access private
exports.deleteWorker = factory.deleteOne(Worker);

// @desc Update spacific Worker
// @Route GET /api/v1/Worker:IdNumber
// @access private
exports.UpdateWorkerDetalsByNID = asyncHandler(async (req, res, next) => {
  const { IdNumber } = req.params;

  // Assuming carNumber is a unique identifier in your Car model
  const worker = await Worker.findOneAndUpdate({ IdNumber }, req.body, {
    new: true,
  });

  if (!worker) {
    return next(
      new apiError(`Can't find worker with this national id  ${IdNumber}`, 404),
    );
  }

  res.status(201).json({ data: worker });
});

// @desc set reword or loans or penalty for worker
// @Route Post /api/v1/Worker/:id
// @access private

exports.moneyFromToworker = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { date, loans, penalty, reward } = req.body;
  let total = 0;
  let greaterSavedMonth = 0;
  let greaterSavedYear = 0;
  if (loans > 0 || penalty > 0 || reward < 0) {
    return next(
      new apiError(
        `the loans and penalty must be negative and reward must be positive`,
        400,
      ),
    );
  }
  const worker = await Worker.findById(id);

  if (!worker) {
    return next(
      new apiError(`Can't find worker with this national id ${id}`, 404),
    );
  }

  const currentDate = new Date(date);
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  worker.loans.forEach((loan) => {
    const loanMonth = new Date(loan.date).getMonth() + 1;
    const loanYear = new Date(loan.date).getFullYear();
    if (loanMonth > greaterSavedMonth) {
      greaterSavedMonth = loanMonth;
    }
    if (loanYear > greaterSavedYear) {
      greaterSavedYear = loanYear;
    }
  });
  worker.penalty.forEach((pen) => {
    const penMonth = new Date(pen.date).getMonth() + 1;
    const penYear = new Date(pen.date).getFullYear();
    if (penMonth > greaterSavedMonth) {
      greaterSavedMonth = penMonth;
    }
    if (penYear > greaterSavedYear) {
      greaterSavedYear = penYear;
    }
  });
  worker.reward.forEach((re) => {
    const reMonth = new Date(re.date).getMonth() + 1;
    const reYear = new Date(re.date).getFullYear();
    if (reMonth > greaterSavedMonth) {
      greaterSavedMonth = reMonth;
    }
    if (reYear > greaterSavedYear) {
      greaterSavedYear = reYear;
    }
  });
  if (currentMonth > greaterSavedMonth || currentYear > greaterSavedYear) {
    worker.salaryAfterProcces = worker.salary;
    worker.salaryAfterReword = worker.salary;
  }
  if (loans < 0) {
    worker.loans.push({ date, amount: loans });
    total = total + loans;
  }

  if (penalty < 0) {
    worker.penalty.push({ date, amount: penalty });
    total = total + penalty;
  }

  if (reward > 0) {
    worker.reward.push({ date, amount: reward });
    total = total + reward;
    worker.salaryAfterReword = worker.salaryAfterReword + reward;
  }
  worker.salaryAfterProcces = worker.salaryAfterProcces + total;

  await worker.save();

  res.status(200).json({ data: worker });
});
