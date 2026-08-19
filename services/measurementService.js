const Measurement = require("../models/measurementModel");
const Repairing = require("../models/repairingModel");
const Car = require("../models/Car");
const Inventory = require("../models/Inventory");
const User = require("../models/userModel");
const apiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");
const ApiFeatures = require("../utils/apiFeatures");

// @desc    Create a new measurement
// @Route   POST /api/v1/measurement
// @access  Private
exports.createMeasurement = asyncHandler(async (req, res, next) => {
  let totalPrice = 0;
  let totalServicesCount = 0;
  let completedServices = 0;
  let newMeasurementNumber = 0;
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
    totalPrice += price;
    totalServicesCount++;
    if (state === "completed") {
      completedServices++;
    }
  }

  for (const { price } of additions) {
    totalPrice += price;
  }

  for (const { id, quantity } of components) {
    const inventoryComponent = await Inventory.findById(id);

    if (!inventoryComponent) {
      return next(
        new apiError(`Component with ID ${id} not found in inventory`, 404),
      );
    }

    const componentPrice = inventoryComponent.price * quantity;
    totalPrice += componentPrice;

    repairDetails.push({
      name: inventoryComponent.name,
      quantity: quantity,
      price: componentPrice,
    });
  }

  const completedServicesRatio =
    totalServicesCount > 0 ? completedServices / totalServicesCount : 0;
  const priceAfterDiscount = totalPrice - discount;

  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + parseInt(daysItTake));

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
    Services: services,
    additions,
    carNumber: carNumber,
    type: type || "periodic",
    totalPrice,
    discount,
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
exports.walkInMeasurement = asyncHandler(async (req, res, next) => {
  let totalPrice = 0;
  let totalServicesCount = 0;
  let completedServices = 0;
  let newMeasurementNumber = 0;
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
    totalPrice += price;
    totalServicesCount++;
    if (state === "completed") {
      completedServices++;
    }
  }

  for (const { price } of additions) {
    totalPrice += price;
  }

  for (const { id, quantity } of components) {
    const inventoryComponent = await Inventory.findById(id);

    if (!inventoryComponent) {
      return next(
        new apiError(`Component with ID ${id} not found in inventory`, 404),
      );
    }

    const componentPrice = inventoryComponent.price * quantity;
    totalPrice += componentPrice;

    repairDetails.push({
      name: inventoryComponent.name,
      quantity: quantity,
      price: componentPrice,
    });
  }

  const completedServicesRatio =
    totalServicesCount > 0 ? completedServices / totalServicesCount : 0;
  const priceAfterDiscount = totalPrice - discount;

  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + parseInt(daysItTake));

  // Create walk-in measurement without car reference
  const measurement = await Measurement.create({
    client: clientName,
    measurementNumber: newMeasurementNumber,
    brand: brand,
    category: category,
    model: model,
    component: repairDetails,
    Services: services,
    additions,
    carNumber: carNumber,
    type: type || "periodic",
    totalPrice,
    discount,
    priceAfterDiscount,
    expectedDate,
    complete: false,
    completedServicesRatio,
    Note1,
    Note2,
    distance: distance || 0,
    nextRepairDistance,
    acceptance: false,
    carId: null,
    generatedCode: null,
  });

  res.status(201).json({ data: measurement });
});

// @desc    Get all measurements
// @Route   GET /api/v1/measurement
// @access  Private
exports.getAllMeasurements = asyncHandler(async (req, res, next) => {
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
exports.getMeasurementByNumber = asyncHandler(async (req, res, next) => {
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
exports.updateMeasurement = asyncHandler(async (req, res, next) => {
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
exports.deleteMeasurement = asyncHandler(async (req, res, next) => {
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
exports.acceptMeasurement = asyncHandler(async (req, res, next) => {
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

  measurement.acceptance = acceptance;
  measurement.acceptedAt = new Date();

  if (acceptance === true) {
    // Convert to repair
    let newId = 0;
    const const_part_of_id = "2021";

    // Generate genId for repair
    const regex = new RegExp("^" + const_part_of_id + "\\d+$", "i");

    const repairs = await Repairing.aggregate([
      { $match: { genId: regex } },
      {
        $project: {
          numericCode: {
            $toInt: {
              $substr: [
                "$genId",
                { $strLenCP: const_part_of_id },
                {
                  $subtract: [
                    { $strLenCP: "$genId" },
                    { $strLenCP: const_part_of_id },
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    const validCodes = repairs
      .map((repair) => repair.numericCode)
      .filter((num) => !isNaN(num) && num > 0)
      .sort((a, b) => a - b);

    if (validCodes.length > 0) {
      for (let i = 0; i < validCodes.length; i++) {
        if (validCodes[i] !== i + 1) {
          newId = const_part_of_id + (i + 1);
          break;
        }
      }
      if (!newId) {
        newId = const_part_of_id + (validCodes.length + 1);
      }
    } else {
      newId = const_part_of_id + "1";
    }

    // Deduct from inventory now that it's accepted
    for (const component of measurement.component) {
      const inventoryComponent = await Inventory.findOne({ name: component.name });

      if (!inventoryComponent) {
        return next(
          new apiError(`Component ${component.name} not found in inventory`, 404),
        );
      }

      if (inventoryComponent.quantity < component.quantity) {
        return next(
          new apiError(
            `Not enough quantity for component ${component.name}. Available: ${inventoryComponent.quantity}, Required: ${component.quantity}`,
            400,
          ),
        );
      }

      inventoryComponent.quantity -= component.quantity;
      await inventoryComponent.save();
    }

    // Create repair from measurement
    const repair = await Repairing.create({
      client: measurement.client,
      genId: newId,
      brand: measurement.brand,
      category: measurement.category,
      model: measurement.model,
      component: measurement.component,
      Services: measurement.Services,
      additions: measurement.additions,
      carNumber: measurement.carNumber,
      type: measurement.type,
      totalPrice: measurement.totalPrice,
      discount: measurement.discount,
      priceAfterDiscount: measurement.priceAfterDiscount,
      expectedDate: measurement.expectedDate,
      complete: false,
      completedServicesRatio: measurement.completedServicesRatio,
      Note1: measurement.Note1,
      Note2: measurement.Note2,
      distance: measurement.distance,
      nextRepairDistance: measurement.nextRepairDistance,
      nextRepairDate: measurement.nextRepairDate,
      carId: measurement.carId,
      generatedCode: measurement.generatedCode,
    });

    measurement.convertedToRepair = true;
    measurement.repairId = repair._id;
    await measurement.save();

    res.status(200).json({
      data: measurement,
      repair: repair,
      message: "Measurement accepted and converted to repair",
    });
  } else {
    await measurement.save();
    res.status(200).json({
      data: measurement,
      message: "Measurement rejected",
    });
  }
});
