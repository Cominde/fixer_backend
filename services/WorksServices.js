const Worker = require("../models/Worker");
//const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");
const moment = require("moment");
const ApiFeatures = require("../utils/apiFeatures");
const searchService = require("./searchService");
const crypto = require("crypto");

// Function to generate a random password
const generateWorkerPassword = () => {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
};
// @desc add Worker
// @Route post /api/v1/Worker
// @access private
exports.addWorker = asyncHandler(async (req, res) => {
  const { name, phoneNumber, jobTitle, salary, IdNumber, role } = req.body;

  const generatedPassword = generateWorkerPassword();

  const newDoc = await Worker.create({
    name,
    phoneNumber,
    jobTitle,
    salary,
    IdNumber,
    salaryAfterProcces: salary,
    salaryAfterReword: salary,
    role,
    generatedPassword,
  });

  // Remove salary fields from response
  const docResponse = newDoc.toObject();
  delete docResponse.salary;
  delete docResponse.salaryAfterProcces;
  delete docResponse.salaryAfterReword;

  res.status(201).json({ data: docResponse });
});

// @desc Get list of Worker
// @Route GET /api/v1/Worker
// @access private
exports.getAllWorkers = asyncHandler(async (req, res, next) => {
  const documentsCounts = await Worker.countDocuments();
  const apiFeatures = new ApiFeatures(Worker.find(), req.query)
    .paginate(documentsCounts)
    .filter()
    .search()
    .limitFields();

  const { mongooseQuery, paginationResult } = apiFeatures;
  let documents = await mongooseQuery;

  documents = documents.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
  for (let i = 0; i < documents.length; i += 1) {
    delete documents[i]._doc.salary;
    delete documents[i]._doc.salaryAfterProcces;
    delete documents[i]._doc.salaryAfterReword;
  }

  res
    .status(200)
    .json({ results: documents.length, paginationResult, data: documents });
});

// @desc Get spacific Worker
// @Route GET /api/v1/Worker
// @access private
exports.searchForWorker = asyncHandler(async (req, res, next) => {
  const { searchString } = req.params;
  const { documents, paginationResult } = await searchService({
    Model: Worker,
    searchString,
    select: "name IdNumber phoneNumber jobTitle",
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
exports.getSpacificWorker = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const worker = await Worker.findById(id);

  if (!worker) {
    return next(new apiError(`No document for this id ${id}`, 404));
  }

  // Remove salary fields from response
  const workerResponse = worker.toObject();
  delete workerResponse.salary;
  delete workerResponse.salaryAfterProcces;
  delete workerResponse.salaryAfterReword;

  res.status(200).json({ data: workerResponse });
});

// @desc Update spacific Worker
// @Route Put /api/v1/Worker
// @access private
exports.UpdateWorkerDetals = asyncHandler(async (req, res, next) => {
  if (req.body.salary) {
    if (!req.body.salaryAfterProcces) {
      req.body.salaryAfterProcces = req.body.salary;
    }
    if (!req.body.salaryAfterReword) {
      req.body.salaryAfterReword = req.body.salary;
    }
  }
  const document = await Worker.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  if (!document) {
    return next(new apiError(`No document for this id ${req.params.id}`, 404));
  }
  // Trigger "save" event when update document
  document.save({ validateBeforeSave: false });
  
  // Remove salary fields from response
  const documentResponse = document.toObject();
  delete documentResponse.salary;
  delete documentResponse.salaryAfterProcces;
  delete documentResponse.salaryAfterReword;
  
  res.status(200).json({ data: documentResponse });
});

// @desc delte Worker
// @Route DELTE /api/v1/Worker
// @access private
exports.deleteWorker = factory.deleteOne(Worker);

// @desc Get list of Worker with salary
// @Route GET /api/v1/Worker/salary
// @access private
exports.getAllWorkersWithSalary = asyncHandler(async (req, res, next) => {
  const documentsCounts = await Worker.countDocuments();
  const apiFeatures = new ApiFeatures(Worker.find(), req.query)
    .paginate(documentsCounts)
    .filter()
    .search()
    .limitFields();

  const { mongooseQuery, paginationResult } = apiFeatures;
  let documents = await mongooseQuery;

  documents = documents.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  res
    .status(200)
    .json({ results: documents.length, paginationResult, data: documents });
});

// @desc Get specific Worker with salary by ID
// @Route GET /api/v1/Worker/salary/:id
// @access private
exports.getWorkerWithSalaryById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const worker = await Worker.findById(id);

  if (!worker) {
    return next(new apiError(`No worker for this id ${id}`, 404));
  }

  res.status(200).json({ data: worker });
});

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

  // Remove salary fields from response
  const workerResponse = worker.toObject();
  delete workerResponse.salary;
  delete workerResponse.salaryAfterProcces;
  delete workerResponse.salaryAfterReword;

  res.status(201).json({ data: workerResponse });
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

  // Use current date if date is not provided
  const transactionDate = date ? new Date(date) : new Date();
  const currentMonth = transactionDate.getMonth() + 1;
  const currentYear = transactionDate.getFullYear();

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
    worker.loans.push({ date: transactionDate, amount: loans });
    total = total + loans;
  }

  if (penalty < 0) {
    worker.penalty.push({ date: transactionDate, amount: penalty });
    total = total + penalty;
  }

  if (reward > 0) {
    worker.reward.push({ date: transactionDate, amount: reward });
    total = total + reward;
    worker.salaryAfterReword = worker.salaryAfterReword + reward;
  }
  worker.salaryAfterProcces = worker.salaryAfterProcces + total;

  await worker.save();

  // Remove salary fields from response
  const workerResponse = worker.toObject();
  delete workerResponse.salary;
  delete workerResponse.salaryAfterProcces;
  delete workerResponse.salaryAfterReword;

  res.status(200).json({ data: workerResponse });
});

// @desc Reset salary fields on first day of month
// @Route This should be called by a cron job on the first day of each month
// @access private

exports.resetSalaryFieldsOnFirstDay = asyncHandler(async (req, res, next) => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const workers = await Worker.find({});

  for (const worker of workers) {
    let greaterSavedMonth = 0;
    let greaterSavedYear = 0;

    // Find the latest month/year from loans, penalties, and rewards
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

    // Reset salary fields if current month/year is greater than saved month/year
    if (currentMonth > greaterSavedMonth || currentYear > greaterSavedYear) {
      worker.salaryAfterProcces = worker.salary;
      worker.salaryAfterReword = worker.salary;
      await worker.save();
    }
  }

  res.status(200).json({ 
    message: "Salary fields reset successfully for eligible workers",
    processedWorkers: workers.length 
  });
});

// @desc Delete specific loan, penalty, or reward from worker
// @Route DELETE /api/v1/Worker/:id/:type/:itemId
// @access private

exports.deleteWorkerFinancialRecord = asyncHandler(async (req, res, next) => {
  const { id, type, itemId } = req.params;

  // Validate type
  const validTypes = ['loans', 'penalty', 'reward'];
  if (!validTypes.includes(type)) {
    return next(new apiError(`Invalid type. Must be one of: ${validTypes.join(', ')}`, 400));
  }

  const worker = await Worker.findById(id);

  if (!worker) {
    return next(new apiError(`Can't find worker with this id ${id}`, 404));
  }

  const arrayField = worker[type];
  const itemIndex = arrayField.findIndex(item => item._id.toString() === itemId);

  if (itemIndex === -1) {
    return next(new apiError(`${type.slice(0, -1)} not found with this id ${itemId}`, 404));
  }

  const item = arrayField[itemIndex];

  // Reverse the financial impact
  if (type === 'loans' || type === 'penalty') {
    // Loans and penalties are negative, so we add the amount back
    worker.salaryAfterProcces = worker.salaryAfterProcces - item.amount;
  } else if (type === 'reward') {
    // Rewards are positive, so we subtract the amount
    worker.salaryAfterReword = worker.salaryAfterReword - item.amount;
    worker.salaryAfterProcces = worker.salaryAfterProcces - item.amount;
  }

  // Remove the item
  arrayField.splice(itemIndex, 1);

  await worker.save();

  // Remove salary fields from response
  const workerResponse = worker.toObject();
  delete workerResponse.salary;
  delete workerResponse.salaryAfterProcces;
  delete workerResponse.salaryAfterReword;

  res.status(200).json({ 
    data: workerResponse, 
    message: `${type.slice(0, -1)} deleted successfully` 
  });
});
