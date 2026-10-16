const Measurement = require("../models/measurementModel");
const Repairing = require("../models/repairingModel");
const Car = require("../models/Car");
const Inventory = require("../models/Inventory");
const User = require("../models/userModel");
const apiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");
const ApiFeatures = require("../utils/apiFeatures");
const { findInventoryForLine } = require("./stockService");
const { createRepairCore } = require("./repairingService");

const toMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (value) => {
  const n = toMoney(value);
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

// @desc    Create a new measurement
// @Route   POST /api/v1/measurement
// @access  Private
export const createMeasurement = asyncHandler(async (req, res, next) => {
  let totalPrice = 0;
  let totalServicesCount = 0;
  let completedServices = 0;
  let newMeasurementNumber: any = 0;
  const const_part_of_id = "MS";
  const {
    components,
    services,
    additions,
    carNumber,
    type,
    discount,
    daysItTake,
    Note1,
    Note2,
    distance,
    nextRepairDistance,
    nextRepairDate,
  } = req.body;

  // Generate measurement number
  const regex = new RegExp("^" + const_part_of_id + "\\d+$", "i");

  const measurements = await Measurement.aggregate([
    { $match: { measurementNumber: regex } },
    {
      $project: {
        numericCode: {
          $toInt: {
            $substr: [
              "$measurementNumber",
              { $strLenCP: const_part_of_id },
              {
                $subtract: [
                  { $strLenCP: "$measurementNumber" },
                  { $strLenCP: const_part_of_id },
                ],
              },
            ],
          },
        },
      },
    },
  ]);

  const validCodes = measurements
    .map((measurement) => measurement.numericCode)
    .filter((num) => !isNaN(num) && num > 0)
    .sort((a, b) => a - b);

  if (validCodes.length > 0) {
    for (let i = 0; i < validCodes.length; i++) {
      if (validCodes[i] !== i + 1) {
        newMeasurementNumber = const_part_of_id + (i + 1);
        break;
      }
    }
    if (!newMeasurementNumber) {
      newMeasurementNumber = const_part_of_id + (validCodes.length + 1);
    }
  } else {
    newMeasurementNumber = const_part_of_id + "1";
  }

  if (!components || !services || !additions) {
    return next(
      new apiError(
        "Components, services, and additions arrays are required",
        400,
      ),
    );
  }

  const repairDetails = [];

  for (const { price, state } of services) {
    totalPrice += toMoney(price);
    totalServicesCount++;
    if (state === "completed") {
      completedServices++;
    }
  }

  for (const { price } of additions) {
    totalPrice += toMoney(price);
  }

  for (const { id, quantity } of components) {
    const inventoryComponent = await Inventory.findById(id);

    if (!inventoryComponent) {
      return next(
        new apiError(`Component with ID ${id} not found in inventory`, 404),
      );
    }

    const qty = toMoney(quantity);
    const componentPrice = toMoney(inventoryComponent.price) * qty;
    totalPrice += componentPrice;

    // The line keeps the inventory id so accepting the quote takes stock
    // from the right item, even if names change.
    repairDetails.push({
      _id: inventoryComponent._id,
      name: inventoryComponent.name,
      quantity: qty,
      price: componentPrice,
    });
  }

  const completedServicesRatio =
    totalServicesCount > 0 ? completedServices / totalServicesCount : 0;
  const priceAfterDiscount = round2(toMoney(totalPrice) - toMoney(discount));

  const expectedDate = new Date();
  if (Number(daysItTake) > 0) {
    expectedDate.setDate(expectedDate.getDate() + parseInt(daysItTake));
  }

  // Get car information
  const car = await Car.findOne({ carNumber });
  if (!car) {
    return next(new apiError(`No car for this number ${carNumber}`, 404));
  }

  const measurement = await Measurement.create({
    client: car.ownerName,
    measurementNumber: newMeasurementNumber,
    brand: car.brand,
    category: car.category,
    model: car.model,
    component: repairDetails,
    Services: services.map((svc) => ({ ...svc, price: toMoney(svc.price) })),
    additions: additions.map((a) => ({ ...a, price: toMoney(a.price) })),
    carNumber: carNumber,
    type: type || "periodic",
    totalPrice,
    discount: toMoney(discount),
    priceAfterDiscount,
    expectedDate,
    complete: false,
    completedServicesRatio,
    Note1,
    Note2,
    distance: distance || 0,
    nextRepairDistance,
    nextRepairDate,
    acceptance: false,
    carId: car._id,
    generatedCode: car.generatedCode,
  });

  res.status(201).json({ data: measurement });
});

// @desc    Create walk-in measurement (without car in system)
// @Route   POST /api/v1/measurement/walkIn
// @access  Private
export const walkInMeasurement = asyncHandler(async (req, res, next) => {
  let totalPrice = 0;
  let totalServicesCount = 0;
  let completedServices = 0;
  let newMeasurementNumber: any = 0;
  const const_part_of_id = "MS";
  const {
    components,
    services,
    additions,
    clientName,
    carNumber,
    brand,
    category,
    model,
    type,
    discount,
    daysItTake,
    Note1,
    Note2,
    distance,
  } = req.body;

  // Validate required fields
  if (!clientName || !carNumber || !brand || !category || !model) {
    return next(
      new apiError(
        "clientName, carNumber, brand, category, and model are required for walk-in measurement",
        400,
      ),
    );
  }

  // Generate measurement number
  const regex = new RegExp("^" + const_part_of_id + "\\d+$", "i");

  const measurements = await Measurement.aggregate([
    { $match: { measurementNumber: regex } },
    {
      $project: {
        numericCode: {
          $toInt: {
            $substr: [
              "$measurementNumber",
              { $strLenCP: const_part_of_id },
              {
                $subtract: [
                  { $strLenCP: "$measurementNumber" },
                  { $strLenCP: const_part_of_id },
                ],
              },
            ],
          },
        },
      },
    },
  ]);

  const validCodes = measurements
    .map((measurement) => measurement.numericCode)
    .filter((num) => !isNaN(num) && num > 0)
    .sort((a, b) => a - b);

  if (validCodes.length > 0) {
    for (let i = 0; i < validCodes.length; i++) {
      if (validCodes[i] !== i + 1) {
        newMeasurementNumber = const_part_of_id + (i + 1);
        break;
      }
    }
    if (!newMeasurementNumber) {
      newMeasurementNumber = const_part_of_id + (validCodes.length + 1);
    }
  } else {
    newMeasurementNumber = const_part_of_id + "1";
  }

  if (!components || !services || !additions) {
    return next(
      new apiError(
        "Components, services, and additions arrays are required",
        400,
      ),
    );
  }

  const repairDetails = [];

  for (const { price, state } of services) {
    totalPrice += toMoney(price);
    totalServicesCount++;
    if (state === "completed") {
      completedServices++;
    }
  }

  for (const { price } of additions) {
    totalPrice += toMoney(price);
  }

  for (const { id, quantity } of components) {
    const inventoryComponent = await Inventory.findById(id);

    if (!inventoryComponent) {
      return next(
        new apiError(`Component with ID ${id} not found in inventory`, 404),
      );
    }

    const qty = toMoney(quantity);
    const componentPrice = toMoney(inventoryComponent.price) * qty;
    totalPrice += componentPrice;

    // The line keeps the inventory id so accepting the quote takes stock
    // from the right item, even if names change.
    repairDetails.push({
      _id: inventoryComponent._id,
      name: inventoryComponent.name,
      quantity: qty,
      price: componentPrice,
    });
  }

  const completedServicesRatio =
    totalServicesCount > 0 ? completedServices / totalServicesCount : 0;
  const priceAfterDiscount = round2(toMoney(totalPrice) - toMoney(discount));

  const expectedDate = new Date();
  if (Number(daysItTake) > 0) {
    expectedDate.setDate(expectedDate.getDate() + parseInt(daysItTake));
  }

  // Create walk-in measurement without car reference
  const measurement = await Measurement.create({
    client: clientName,
    measurementNumber: newMeasurementNumber,
    brand: brand,
    category: category,
    model: model,
    component: repairDetails,
    Services: services.map((svc) => ({ ...svc, price: toMoney(svc.price) })),
    additions: additions.map((a) => ({ ...a, price: toMoney(a.price) })),
    carNumber: carNumber,
    type: type || "periodic",
    totalPrice,
    discount: toMoney(discount),
    priceAfterDiscount,
    expectedDate,
    complete: false,
    completedServicesRatio,
    Note1,
    Note2,
    distance: distance || 0,
    acceptance: false,
    carId: null,
    generatedCode: null,
  });

  res.status(201).json({ data: measurement });
});

// @desc    Get all measurements
// @Route   GET /api/v1/measurement
// @access  Private
export const getAllMeasurements = asyncHandler(async (req, res, next) => {
  const documentsCounts = await Measurement.countDocuments();
  const apiFeatures = new ApiFeatures(Measurement.find(), req.query)
    .sort()
    .paginate(documentsCounts)
    .filter()
    .search("Measurement")
    .limitFields();
  const { mongooseQuery, paginationResult } = apiFeatures;
  const measurements = await mongooseQuery;

  // Add next page to paginationResult
  paginationResult.next = paginationResult.currentPage < paginationResult.numberOfPages
    ? paginationResult.currentPage + 1
    : null;

  res.status(200).json({
    results: measurements.length,
    paginationResult,
    data: measurements,
  });
});

// @desc    Get specific measurement by number
// @Route   GET /api/v1/measurement/:measurementNumber
// @access  Private
export const getMeasurementByNumber = asyncHandler(async (req, res, next) => {
  const { measurementNumber } = req.params;

  const measurement = await Measurement.findOne({ measurementNumber });

  if (!measurement) {
    return next(
      new apiError(
        `No measurement found for number ${measurementNumber}`,
        404,
      ),
    );
  }

  res.status(200).json({ data: measurement });
});

// @desc    Update measurement
// @Route   PUT /api/v1/measurement/:id
// @access  Private
export const updateMeasurement = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const measurement = await Measurement.findById(id);

  if (!measurement) {
    return next(new apiError(`No measurement found with id ${id}`, 404));
  }

  // Prevent updating acceptance directly - use acceptMeasurement endpoint
  if (req.body.acceptance !== undefined) {
    return next(
      new apiError(
        "Use the acceptMeasurement endpoint to accept/reject measurements",
        400,
      ),
    );
  }

  Object.assign(measurement, req.body);
  await measurement.save();

  res.status(200).json({ data: measurement });
});

// @desc    Delete measurement
// @Route   DELETE /api/v1/measurement/:id
// @access  Private
export const deleteMeasurement = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const measurement = await Measurement.findById(id);

  if (!measurement) {
    return next(new apiError(`No measurement found with id ${id}`, 404));
  }

  if (measurement.convertedToRepair) {
    return next(
      new apiError(
        "Cannot delete measurement that has been converted to repair",
        400,
      ),
    );
  }

  await Measurement.findByIdAndDelete(id);

  res.status(204).json();
});

// @desc    Accept measurement and convert to repair
// @Route   PUT /api/v1/measurement/:id/accept
// @access  Private
export const acceptMeasurement = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { acceptance } = req.body;

  if (typeof acceptance !== "boolean") {
    return next(new apiError("acceptance must be a boolean value", 400));
  }

  const measurement = await Measurement.findById(id);

  if (!measurement) {
    return next(new apiError(`No measurement found with id ${id}`, 404));
  }

  if (measurement.convertedToRepair) {
    return next(
      new apiError("Measurement has already been converted to repair", 400),
    );
  }

  if (acceptance !== true) {
    measurement.acceptance = acceptance;
    measurement.acceptedAt = new Date();
    await measurement.save();
    return res.status(200).json({
      data: measurement,
      message: "Measurement rejected",
    });
  }

  // Claim the quote first, so two clicks can't convert it twice.
  const claimed = await Measurement.findOneAndUpdate(
    { _id: id, convertedToRepair: { $ne: true } },
    { $set: { convertedToRepair: true, acceptance: true, acceptedAt: new Date() } },
    { new: true },
  );
  if (!claimed) {
    return next(
      new apiError("Measurement has already been converted to repair", 400),
    );
  }

  const releaseClaim = () =>
    Measurement.updateOne(
      { _id: id },
      { $set: { convertedToRepair: false, acceptance: measurement.acceptance } },
    );

  let repair;
  try {
    // Quote lines carry the inventory id; older quotes are matched by name.
    const components = [];
    for (const line of claimed.component) {
      const inventoryItem = await findInventoryForLine(line);
      if (!inventoryItem) {
        throw new apiError(`Component ${line.name} not found in inventory`, 404);
      }
      components.push({
        id: String(inventoryItem._id),
        quantity: line.quantity,
        price: line.price,
      });
    }

    const input = {
      components,
      services: claimed.Services.map((svc) => ({
        name: svc.name,
        price: svc.price,
        state: svc.state,
      })),
      additions: claimed.additions.map((a) => ({ name: a.name, price: a.price })),
      carNumber: claimed.carNumber,
      type: claimed.type || "periodic",
      discount: claimed.discount,
      Note1: claimed.Note1,
      Note2: claimed.Note2,
      distance: claimed.distance,
      nextRepairDistance: claimed.nextRepairDistance,
      nextRepairDate: claimed.nextRepairDate,
      clientName: claimed.client,
      brand: claimed.brand,
      category: claimed.category,
      model: claimed.model,
    };

    const car = claimed.carId ? await Car.findById(claimed.carId) : null;
    if (claimed.carId && !car) {
      throw new apiError(`The car for this measurement no longer exists`, 404);
    }

    // Same path as a new invoice: car state, counters and stock. The quoted
    // part prices are kept so the customer pays what they were quoted.
    repair = await createRepairCore(req, input, {
      car,
      keepComponentPrices: true,
      expectedDate: claimed.expectedDate,
    });
  } catch (error) {
    await releaseClaim();
    throw error;
  }

  // Delete the measurement after converting to repair
  await Measurement.findByIdAndDelete(id);

  res.status(200).json({
    repair: repair,
    message: "Measurement accepted and converted to repair",
  });
});
