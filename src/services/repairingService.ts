const Inventory = require("../models/Inventory");
const Repairing = require("../models/repairingModel");
const Car = require("../models/Car");
const User = require("../models/userModel");
const Worker = require("../models/Worker");
//const slugify = require("slugify");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");
const ApiFeatures = require("../utils/apiFeatures");
const { searchService, searchCarService } = require("./searchService");
const { normalizeCarNumber } = require("../utils/carNumberCheck");
const mongoose = require("mongoose");
const {
  applyStockChanges,
  revertStockChanges,
  findInventoryForLine,
} = require("./stockService");
const { refreshMonthlyRepairs, technicianIds } = require("./payrollService");
const {
  INVOICE_PREFIX,
  nextInvoiceNumber,
  peekInvoiceNumber,
} = require("../utils/sequence");
const asyncHandler = require("express-async-handler");
const { body } = require("express-validator");
const { ObjectId } = require("bson");
const {
  resolveReceptionEngineer,
  resolveRepresentative,
  hasReceptionInput,
  hasRepresentativeInput,
  sanitizePersonName,
} = require("../utils/invoiceAttribution");

/**
 * Money contract for repair components:
 * `component.price` is always a LINE TOTAL (inventory unit price × quantity).
 * Services/additions `price` are line amounts as sent by the client.
 */
const toMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Round to 2 decimal places — only for final monetary results. */
const round2 = (value) => {
  const n = toMoney(value);
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const sumRepairLineTotals = (repair) => {
  let total = 0;
  for (const line of repair.Services || []) total += toMoney(line.price);
  for (const line of repair.additions || []) total += toMoney(line.price);
  for (const line of repair.component || []) total += toMoney(line.price);
  return total;
};

const applyRepairTotals = (repair) => {
  const totalPrice = sumRepairLineTotals(repair);
  const discount = toMoney(repair.discount);
  repair.totalPrice = totalPrice;
  // Single source of truth: round2(subtotal − discount). Do not round discount alone.
  repair.priceAfterDiscount = round2(totalPrice - discount);
  return { totalPrice, priceAfterDiscount: repair.priceAfterDiscount };
};

/**
 * Serialise writes to the same repair inside this process, so two service
 * ticks arriving together cannot overwrite each other's completion result.
 */
const repairLocks = new Map();
const withRepairLock = async (repairId, fn) => {
  const key = String(repairId);
  const run = (repairLocks.get(key) || Promise.resolve()).then(fn);
  const tail = run.catch(() => {});
  repairLocks.set(key, tail);
  try {
    return await run;
  } finally {
    if (repairLocks.get(key) === tail) repairLocks.delete(key);
  }
};

/**
 * Mirror a repair's completion onto its car (State, repairing flag, ratio).
 * The car stays in the garage while it has any other open repair.
 * Returns false when the car does not exist.
 */
const syncCarWithRepair = async (repair, nextRepairDate?) => {
  const car = await Car.findById(repair.carId).select("nextRepairDate");
  if (!car) return false;

  let openRepair = repair.complete ? null : repair;
  if (!openRepair) {
    openRepair = await Repairing.findOne({
      carId: repair.carId,
      complete: false,
      _id: { $ne: repair._id },
    }).select("_id completedServicesRatio");
  }

  if (openRepair) {
    await Car.updateOne(
      { _id: repair.carId },
      {
        $set: {
          State: "Repair",
          repairing: true,
          repairing_id: openRepair._id,
          completedServicesRatio: openRepair.completedServicesRatio,
        },
      },
    );
    return true;
  }

  const now = new Date();
  const next = nextRepairDate || car.nextRepairDate;
  await Car.updateOne(
    { _id: repair.carId },
    {
      $set: {
        State: next && now >= new Date(next) ? "Need to check" : "Good",
        repairing: false,
        completedServicesRatio: repair.completedServicesRatio,
        lastRepairDate: now,
      },
      $unset: { repairing_id: "" },
    },
  );
  return true;
};

async function resolveReceptionForRequest(body, user) {
  if (hasReceptionInput(body)) {
    return resolveReceptionEngineer(body);
  }
  if (user && user._id) {
    const worker = await Worker.findById(user._id);
    if (worker && worker.name) {
      return sanitizePersonName(worker.name, { fallback: "NA" }) || "NA";
    }
  }
  return "NA";
}

const isMissing = (value) =>
  value === undefined || value === null || value === "";

/** A money amount that must be a number of 0 or more. Missing counts as 0. */
const requireNonNegativeMoney = (value, label) => {
  if (isMissing(value)) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new apiError(`${label} must be a number of 0 or more`, 400);
  }
  return n;
};

const requirePositiveQty = (value, label) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new apiError(`Quantity for ${label} must be greater than zero`, 400);
  }
  return n;
};

/** Discount must be between 0 and the invoice subtotal. */
const requireValidDiscount = (discount, subtotal) => {
  const amount = requireNonNegativeMoney(discount, "Discount");
  if (amount > round2(subtotal) + 1e-9) {
    throw new apiError(
      `Discount (${amount}) can't be more than the invoice subtotal (${round2(subtotal)})`,
      400,
    );
  }
  return amount;
};

const carStateAfterRepair = (complete, nextRepairDate) => {
  if (!complete) return "Repair";
  return new Date() < new Date(nextRepairDate) ? "Good" : "Need to check";
};

/**
 * Creates a repair (registered car, registered walk-in or anonymous walk-in).
 *
 * Everything is validated before anything is written. Stock is then taken
 * in one all-or-nothing step, and put back if the repair can't be saved, so
 * a failed request never leaves stock deducted.
 *
 * opts.car                 registered car; omit for an anonymous walk-in
 * opts.attributionBody     body read for receptionEngineer / representative
 * opts.keepComponentPrices use each component line's own `price` (quote conversion)
 * opts.expectedDate        fixed expected date instead of now + daysItTake
 * opts.preserveCarSchedule keep the car's next service date/distance (registered walk-in)
 */
export const createRepairCore = async (req, input, opts: any = {}) => {
  const { components, services, additions } = input;
  if (
    !Array.isArray(components) ||
    !Array.isArray(services) ||
    !Array.isArray(additions)
  ) {
    throw new apiError(
      "Components, services, and additions arrays are required",
      400,
    );
  }

  const car = opts.car || null;
  const type = car ? input.type : input.type || "periodic";
  if (car && type !== "periodic" && type !== "nonPeriodic") {
    throw new apiError(`the type must be periodic or nonPeriodic only`, 400);
  }

  let totalPrice = 0;
  let totalServicesCount = 0;
  let completedServices = 0;

  const normalizedServices = services.map((s) => {
    const price = requireNonNegativeMoney(
      s?.price,
      `Price of service "${s?.name ?? ""}"`,
    );
    totalPrice += price;
    totalServicesCount++;
    if (s?.state === "completed") completedServices++;
    return { ...s, price };
  });

  const normalizedAdditions = additions.map((a) => {
    const price = requireNonNegativeMoney(
      a?.price,
      `Price of addition "${a?.name ?? ""}"`,
    );
    totalPrice += price;
    return { ...a, price };
  });

  // Read-only checks; stock is only taken once the whole invoice is valid.
  const repairDetails = [];
  const stockChanges = [];
  for (const line of components) {
    const id = line?.id;
    const inventoryComponent = mongoose.Types.ObjectId.isValid(id)
      ? await Inventory.findById(id)
      : null;
    if (!inventoryComponent) {
      throw new apiError(`Component with ID ${id} not found in inventory`, 404);
    }
    const qty = requirePositiveQty(line.quantity, inventoryComponent.name);
    if (inventoryComponent.quantity < qty) {
      throw new apiError(`Not enough quantity for component with id ${id}`, 400);
    }

    // component.price is always LINE TOTAL (unit × qty)
    const componentPrice = opts.keepComponentPrices
      ? requireNonNegativeMoney(line.price, `Price of ${inventoryComponent.name}`)
      : toMoney(inventoryComponent.price) * qty;
    totalPrice += componentPrice;

    repairDetails.push({
      name: inventoryComponent.name,
      quantity: qty,
      price: componentPrice,
      _id: new ObjectId(String(id)),
    });
    stockChanges.push({ id: String(id), qty });
  }

  const discountAmount = requireValidDiscount(input.discount, totalPrice);
  const priceAfterDiscount = round2(totalPrice - discountAmount);
  const completedServicesRatio =
    totalServicesCount > 0 ? completedServices / totalServicesCount : 0;
  // Anonymous walk-ins always start open, as before.
  const complete = car ? completedServices === totalServicesCount : false;

  // Next service schedule (registered cars only).
  let finalDistance = input.distance;
  let nextDistance = input.nextRepairDistance;
  let nextRDate = input.nextRepairDate;
  if (car) {
    if (opts.preserveCarSchedule) {
      nextDistance = car.nextRepairDistance;
      nextRDate = car.nextRepairDate;
      if (isMissing(finalDistance)) finalDistance = car.distances;
    } else if (
      type === "nonPeriodic" ||
      input.nextRepairDate === "" ||
      input.nextRepairDistance === ""
    ) {
      // For non-periodic repairs or when nextRepairDate/nextRepairDistance are empty, get values from last periodic repair
      const lastPeriodicRepair = await Repairing.findOne({
        carNumber: input.carNumber,
        type: "periodic",
      }).sort({ createdAt: -1 });

      if (lastPeriodicRepair) {
        nextDistance = lastPeriodicRepair.nextRepairDistance || 0;
        nextRDate = lastPeriodicRepair.nextRepairDate;
      } else {
        nextDistance = 0;
        nextRDate = undefined;
      }
    }
  }

  let newId;
  if (input.manually == "True" || input.manually == true) {
    const parsedCarCode = parseInt(input.id, 10);
    if (isNaN(parsedCarCode) || !Number.isInteger(parsedCarCode)) {
      throw new apiError(`Invalid carCode. It must be a number.`, 400);
    }
    newId = INVOICE_PREFIX + parsedCarCode;
    if (await Repairing.exists({ genId: newId })) {
      throw new apiError(`Repairing with id ${newId} already exists.`, 400);
    }
  } else {
    newId = await nextInvoiceNumber();
  }

  const expectedDate = opts.expectedDate
    ? new Date(opts.expectedDate)
    : new Date();
  if (!opts.expectedDate && Number(input.daysItTake) > 0) {
    expectedDate.setDate(expectedDate.getDate() + parseInt(input.daysItTake));
  }

  const attribution = opts.attributionBody || {};
  const receptionEngineer = await resolveReceptionForRequest(
    attribution,
    req.user,
  );
  const representative = resolveRepresentative(attribution);
  const technicians = Array.isArray(input.technicians) ? input.technicians : [];

  const applied = await applyStockChanges(stockChanges);
  let repair;
  try {
    repair = await Repairing.create({
      client: car ? car.ownerName : input.clientName,
      genId: newId,
      brand: car ? car.brand : input.brand,
      category: car ? car.category : input.category,
      model: car ? car.model : input.model,
      component: repairDetails,
      Services: normalizedServices,
      additions: normalizedAdditions,
      carNumber: input.carNumber,
      type,
      totalPrice,
      discount: discountAmount,
      priceAfterDiscount,
      expectedDate,
      complete,
      completedServicesRatio,
      Note1: input.Note1,
      Note2: input.Note2,
      distance: car ? finalDistance : toMoney(input.distance),
      ...(car
        ? {
            nextRepairDistance: nextDistance,
            nextRepairDate: nextRDate,
            carId: car._id,
            generatedCode: car.generatedCode,
          }
        : {}),
      technicians,
      Reception: receptionEngineer,
      receptionEngineer,
      representative,
    });
  } catch (error) {
    await revertStockChanges(applied);
    throw error;
  }

  if (car) {
    if (type == "periodic") {
      car.periodicRepairs = (car.periodicRepairs || 0) + 1;
    } else {
      car.nonPeriodicRepairs = (car.nonPeriodicRepairs || 0) + 1;
    }
    car.distances = finalDistance;
    car.nextRepairDistance = nextDistance;
    car.nextRepairDate = nextRDate;
    car.State = carStateAfterRepair(complete, nextRDate);
    car.completedServicesRatio = completedServicesRatio;
    if (complete) {
      car.lastRepairDate = new Date();
      car.repairing = false;
    } else {
      car.repairing_id = repair._id;
      car.repairing = true;
    }
    try {
      await car.save({ validateBeforeSave: false });
    } catch (error) {
      console.error(`Repair ${repair._id} saved but car ${car._id} update failed:`, error);
    }
  }

  for (const technician of technicians) {
    if (mongoose.Types.ObjectId.isValid(technician?.workerId)) {
      await Worker.updateOne(
        { _id: technician.workerId },
        { $inc: { numberOfRepairs: 1 } },
      );
    }
  }
  await refreshMonthlyRepairs(technicianIds(repair));

  return repair;
};

// @desc create a repairing
// @Route POST /api/v1/repairing
// @access private
export const createRepairing = asyncHandler(async (req, res, next) => {
  // Check if body is empty after normalization
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new apiError('Request body cannot be empty', 400));
  }

  // Whitelist allowed fields to prevent mass assignment
  const allowedFields = [
    'components',
    'services',
    'additions',
    'carNumber',
    'type',
    'discount',
    'daysItTake',
    'nextRepairDate',
    'Note1',
    'Note2',
    'distance',
    'nextRepairDistance',
    'technicians',
    'manually',
    'id',
    'reception',
    'representative'
  ];

  // Filter body to only include allowed fields
  const filteredBody: any = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      filteredBody[field] = req.body[field];
    }
  }

  const car = await Car.findOne({ carNumber: filteredBody.carNumber });
  if (!car) {
    return next(
      new apiError(`No car for this number ${filteredBody.carNumber}`, 404),
    );
  }

  const repair = await createRepairCore(req, filteredBody, {
    car,
    attributionBody: req.body,
  });

  res.status(200).json({
    data: {
      _id: repair._id,
      genId: repair.genId,
      receptionEngineer: repair.receptionEngineer,
      representative: repair.representative,
    },
  });
});

// @desc    Create walk-in repair (without car/user in system)
// @route   POST /api/v1/repairing/walkIn
// @access  Private
export const walkInRepair = asyncHandler(async (req, res, next) => {
  // Check if body is empty after normalization
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new apiError('Request body cannot be empty', 400));
  }

  // Whitelist allowed fields to prevent mass assignment
  const allowedFields = [
    'components',
    'services',
    'additions',
    'clientName',
    'carNumber',
    'brand',
    'category',
    'model',
    'type',
    'discount',
    'daysItTake',
    'Note1',
    'Note2',
    'distance',
    'technicians',
    'manually',
    'id',
    'reception',
    'representative',
    'carCode',
    'code',
    'skipCode',
  ];

  // Filter body to only include allowed fields
  const filteredBody: any = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      filteredBody[field] = req.body[field];
    }
  }

  // Walk-in for a client who already has a code: attach it to their car.
  const skipCode =
    filteredBody.skipCode === true || filteredBody.skipCode === "true";
  const registeredCode = skipCode
    ? ""
    : String(filteredBody.carCode ?? filteredBody.code ?? "").trim();
  if (registeredCode) {
    const car = await Car.findOne({ generatedCode: registeredCode });
    if (!car) {
      return next(
        new apiError(`No registered car with code ${registeredCode}`, 404),
      );
    }
    const repair = await createRepairCore(
      req,
      {
        ...filteredBody,
        carNumber: car.carNumber,
        type: filteredBody.type || "periodic",
      },
      { car, attributionBody: req.body, preserveCarSchedule: true },
    );
    return res.status(201).json({ data: repair });
  }

  const { clientName, carNumber, brand, category, model } = filteredBody;

  // Validate required fields
  if (!clientName || !carNumber || !brand || !category || !model) {
    return next(
      new apiError(
        "clientName, carNumber, brand, category, and model are required for walk-in repair",
        400,
      ),
    );
  }

  const repair = await createRepairCore(
    req,
    { ...filteredBody, carNumber: normalizeCarNumber(carNumber) },
    { attributionBody: req.body },
  );

  res.status(201).json({ data: repair });
});

// @desc Update inventory and save services
// @Route POST /api/v1/services
// @access private
/*exports.updateInventoryAndServices = asyncHandler(async (req, res, next) => {
  var componentsPrice = 0;
  var totalPrice = 0;
  var updatedComponents = []; // Array to store updated components
  var createdServices = []; // Array to store created services
  var createdChecks = []; // Array to store created checks
  var completedServicesCount = 0; // Counter for completed services
  var totalServicesCount = 0; // Counter for total services

  const { components, services, checks } = req.body; // Extract checks array from request body

  if (!components || !services || !checks) {
    return next(
      new apiError("Components, services, and checks arrays are required", 400)
    );
  }

  try {
    // Update inventory
    for (const { id, quantity } of components) {
      const component = await Inventory.findById(id);
      if (!component) {
        return next(new apiError(`Component with id ${id} not found.`, 404));
      }
      if (component.quantity < quantity) {
        return next(
          new apiError(`Not enough quantity for component with id ${id}`, 400)
        );
      }
      component.quantity -= quantity;
      componentsPrice += component.price * quantity; // Accumulate total price
      totalPrice = componentsPrice;
      await component.save();
      updatedComponents.push(component); // Add updated component to the array
    }

    // Save services
    for (const { name, price, carnumber, status, daysItTake } of services) {
      totalPrice += price; // Calculate total price for each service
      totalServicesCount++; // Increment total services count

      // Add daysItTake to the current date to get the expected date
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + parseInt(daysItTake));

      const service = await Services.create({
        name,
        price,
        status, // Include the status of the service
        totalPrice: totalPrice,
        comPrice: componentsPrice,
        carNumber: carnumber,
        state: status,
        expectedDate: expectedDate, // Save expected date
      });
      createdServices.push(service); // Add created service to the array
      if (status === "completed") {
        // Increment completed services count if status is 'completed'
        completedServicesCount++;
      }
    }

    // Save checks
    for (const { name, price, carnumber, daysItTake, nextCheck } of checks) {
      // Add daysItTake to the current date to get the expected date
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + parseInt(daysItTake));

      const nextcheckDate = new Date();
      nextcheckDate.setDate(nextcheckDate.getDate() + parseInt(nextCheck));
      const check = await Check.create({
        name,
        price,
        carNumber: carnumber,
        expectedDate: expectedDate, // Save expected date
        nextcheckDate: nextcheckDate, // Save next check date
      });
      createdChecks.push(check); // Add created service to the array
    }

    const completedServicesRatio =
      totalServicesCount > 0 ? completedServicesCount / totalServicesCount : 0; // Calculate completed services ratio

    res.status(200).json({
      data: {
        totalPrice: totalPrice,
        completedServicesRatio: completedServicesRatio,
        numServices: totalServicesCount,
        numChecks: createdChecks.length, // Return the number of checks created
      },
    }); // Send back the total price, completed services ratio, number of services, and number of checks in the JSON response
  } catch (error) {
    console.error("Error:", error);
    next(new apiError("Internal Server Error", 500));
  }
});
*/

// @desc Search for car services by car number
// @Route GET /api/v1/repairing/:carNumber
// @access private
export const getCarRepairsByNumber = asyncHandler(async (req, res, next) => {
  const { carNumber } = req.params;

  try {
    const repairing = await Repairing.find({ carNumber });

    if (!repairing) {
      return next(
        new apiError(
          `Can't find services for this car number ${carNumber}`,
          404,
        ),
      );
    }
    const sortedRepairs = repairing.sort(
      (a, b) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any),
    );
    res.status(200).json({ data: repairing });
  } catch (error) {
    console.error("Error:", error);
    next(new apiError("Internal Server Error", 500));
  }
});

// @desc Update service state in repairing schema by service ID
// @Route PUT /api/v1/repairing/:serviceId
// @access private
export const updateServiceStateById = asyncHandler(async (req, res, next) => {
  const { serviceId } = req.params;
  const { newState } = req.body;

  if (!ObjectId.isValid(serviceId)) {
    return next(new apiError(`Invalid service id ${serviceId}`, 400));
  }
  if (newState !== "repairing" && newState !== "completed") {
    return next(
      new apiError(`newState must be "repairing" or "completed"`, 400),
    );
  }

  const owner = await Repairing.findOne({ "Services._id": serviceId }).select(
    "_id",
  );
  if (!owner) {
    return next(
      new apiError(
        `Service with ID ${serviceId} not found in any repairing document`,
        404,
      ),
    );
  }

  const repairingDoc = await withRepairLock(owner._id, async () => {
    const svcId = new ObjectId(serviceId);
    // Set the state and recompute ratio/complete from the stored array in one
    // atomic update, so concurrent ticks never count from a stale copy.
    const doc = await Repairing.findOneAndUpdate(
      { _id: owner._id, "Services._id": svcId },
      [
        {
          $set: {
            Services: {
              $map: {
                input: "$Services",
                as: "s",
                in: {
                  $cond: [
                    { $eq: ["$$s._id", svcId] },
                    { $mergeObjects: ["$$s", { state: newState }] },
                    "$$s",
                  ],
                },
              },
            },
          },
        },
        {
          $set: {
            _done: {
              $size: {
                $filter: {
                  input: "$Services",
                  as: "s",
                  cond: { $eq: ["$$s.state", "completed"] },
                },
              },
            },
            _total: { $size: "$Services" },
          },
        },
        {
          $set: {
            completedServicesRatio: {
              $cond: [
                { $gt: ["$_total", 0] },
                { $divide: ["$_done", "$_total"] },
                0,
              ],
            },
            complete: { $eq: ["$_done", "$_total"] },
            updatedAt: "$$NOW",
          },
        },
        {
          // Same transitions as the pre-save hook (not run for updates).
          $set: {
            completedAt: {
              $cond: ["$complete", { $ifNull: ["$completedAt", "$$NOW"] }, null],
            },
          },
        },
        { $unset: ["_done", "_total"] },
      ],
      { new: true },
    );
    if (doc) {
      // Recount from completed repairs; re-ticking a done service no longer adds one.
      await refreshMonthlyRepairs(technicianIds(doc));
      await syncCarWithRepair(doc);
    }
    return doc;
  });

  if (!repairingDoc) {
    return next(
      new apiError(
        `Service with ID ${serviceId} not found within any repairing document`,
        404,
      ),
    );
  }

  const service = repairingDoc.Services.find((s) => s._id.equals(serviceId));
  res.status(200).json({
    data: service,
    message: `Service state updated to ${newState}`,
  });
});

// @desc get all completed repairs
// @Route get /api/v1/repairing
// @access private
export const getAllComRepairs = asyncHandler(async (req, res, next) => {
  let filter = { complete: true };

  const documentsCounts = await Repairing.countDocuments(filter);
  const apiFeatures = new ApiFeatures(Repairing.find(filter), req.query)
    .sort()
    .paginate(documentsCounts)
    .filter()
    .search()
    .limitFields();
  const { mongooseQuery, paginationResult } = apiFeatures;
  const repairs = await mongooseQuery;

  const carIds = repairs.map((repair) => repair.carId);

  const cars = await Car.find({ _id: { $in: carIds } });

  const carCodeMap = {};
  cars.forEach((car) => {
    carCodeMap[car._id.toString()] = car.generatedCode;
  });

  let enrichedRepairs = repairs
    .map((repair) => {
      const carCode = carCodeMap[repair.carId?.toString()];
      const car = cars.find(
        (car) => car._id.toString() === repair.carId?.toString(),
      );
      if (car) {
        return {
          brand: car.brand,
          category: car.category,
          model: car.model,
          client: repair.client,
          priceAfterDiscount: repair.priceAfterDiscount,
          carCode: carCode,
          paidOn: repair.createdAt,
          id: repair._id,
        };
      } else {
        // return the walk-in repairs
        return {
          brand: repair.brand,
          category: repair.category,
          model: repair.model,
          client: repair.client,
          priceAfterDiscount: repair.priceAfterDiscount,
          carCode: null,
          paidOn: repair.createdAt,
          id: repair._id,
        };
      }
    })
    .filter((item) => item !== null); // Filter out null entries
  enrichedRepairs = enrichedRepairs.sort(
    (a, b) => (new Date(b.paidOn) as any) - (new Date(a.paidOn) as any),
  );

  // Add next page to paginationResult
  paginationResult.next =
    paginationResult.currentPage < paginationResult.numberOfPages
      ? paginationResult.currentPage + 1
      : null;

  res.status(200).json({
    results: enrichedRepairs.length,
    paginationResult,
    data: enrichedRepairs,
  });
});

// @desc Search for car services by car id
// @Route GET /api/v1/repairing/getById/:id
// @access private
export const getCarRepairsByid = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  // FE sends ?type= on GET; body is empty for GET. Accept query first, body fallback.
  const type = req.query.type ?? req.body?.type;
  const car = await Car.findById(id);

  if (!car || car.length === 0) {
    const repair = await Repairing.findById(id);
    if (repair) {
      return res.status(200).json({ data: [repair] });
    }

    return next(new apiError(`Can't car with this id ${id}`, 404));
  }

  let query: any = { carId: car._id };

  // Filter by type if specified (periodic | nonPeriodic | all/omit = all)
  if (type === "periodic") {
    query.type = "periodic";
  } else if (type === "nonPeriodic") {
    query.type = "nonPeriodic";
  }

  const repairing = await Repairing.find(query);
  if (!repairing || repairing.length === 0) {
    return next(new apiError(`Can't find services for this car  ${id}`, 404));
  }
  const sortedRepairs = repairing.sort(
    (a, b) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any),
  );
  res.status(200).json({ data: sortedRepairs });
});

// @desc search for car services by generated Code with pagination
// @Route GET /api/v1/repairing/gen/:generatedCode
// @access Private
export const getCarRepairsByGenCode = asyncHandler(async (req, res, next) => {
  const { generatedCode } = req.params;

  // Find the car by generated code
  const car = await Car.findOne({ generatedCode });
  if (!car) {
    return next(
      new apiError(
        `Can't find car with this generated Code: ${generatedCode}`,
        404,
      ),
    );
  }

  // Set up pagination and other features for car repairs
  const documentsCount = await Repairing.countDocuments({
    carId: { $in: car._id },
  });
  const apiFeatures = new ApiFeatures(
    Repairing.find({ carId: { $in: car._id } }),
    req.query,
  )
    .paginate(documentsCount)
    .filter()
    .search("Repairing") // Specify fields for search if needed
    .limitFields();

  const { mongooseQuery, paginationResult } = apiFeatures;
  let repairs = await mongooseQuery;

  // Sort repairs by creation date
  repairs = repairs.sort(
    (a, b) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any),
  );

  // Add next page to paginationResult
  paginationResult.next =
    paginationResult.currentPage < paginationResult.numberOfPages
      ? paginationResult.currentPage + 1
      : null;

  // Respond with paginated repair data
  res.status(200).json({
    results: repairs.length,
    paginationResult,
    data: repairs,
  });
});

// @desc get the detiles for repair report
// @Route GET /api/v1/repairing/report/:id
// @access private
export const getRepairsReport = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const Repair = await Repairing.findById(id);

  if (!Repair) {
    return next(new apiError(`Can't find repair with this id ${id}`, 404));
  }

  const carInfo = Repair.carId
    ? await Car.findById(Repair.carId)
    : await Car.findOne({ carNumber: Repair.carNumber });
  const userInfo = carInfo
    ? await User.findOne({ name: carInfo.ownerName })
    : null;

  const receptionEngineer =
    Repair.receptionEngineer || Repair.Reception || "NA";
  const representative = Repair.representative || null;

  const info = {
    name: carInfo?.ownerName || Repair.client || null,
    phone: userInfo?.phoneNumber || null,
    carNumber: carInfo?.carNumber || Repair.carNumber || null,
    chassisNumber: carInfo?.chassisNumber || null,
    brand: carInfo?.brand || Repair.brand || null,
    category: carInfo?.category || Repair.category || null,
    color: carInfo?.color || null,
    distances: carInfo?.distances ?? Repair.distance ?? null,
    model: carInfo?.model || Repair.model || null,
    clientCode: carInfo?.generatedCode || Repair.generatedCode || null,
    note1: Repair.Note1,
    note2: Repair.Note2,
    receptionEngineer,
    representative,
    Reception: receptionEngineer,
  };

  res.status(200).json({
    repair: Repair,
    data: info,
  });
});
// @desc suggest the next invoice number (the part after "2021")
// @Route GET /api/v1/repairing/nextCode/suggestNextCodeNumber
export const suggestNextCodeNumber = asyncHandler(async (req, res, next) => {
  // Numbers come from a counter and are never reused after a delete.
  const newId = await peekInvoiceNumber();
  res.status(200).json({ data: newId });
});

// @desc upadete repair car
// @Route PUT /api/v1/repair/update/:id
// @access private
const updateRepairHandler = async (req, res, next) => {
  // Check if body is empty after normalization
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new apiError('Request body cannot be empty', 400));
  }

  const repair = await Repairing.findById(req.params.id);

  if (!repair) {
    return next(new apiError(`No repair for this ID: ${req.params.id}`, 404));
  }
  // Walk-ins have no car; car bookkeeping is skipped for them.
  const hasCar = Boolean(repair.carId);
  const techniciansBefore = technicianIds(repair);
  const discountBefore = toMoney(repair.discount);
  const subtotalBefore = sumRepairLineTotals(repair);

  // Nothing is written until every change below has been validated.
  // Stock changes and car updates are collected here and applied after.
  const stockChanges = [];
  const carUpdates: any = {};
  let typeChange = null;
  const workerCountChanges = [];

  if (req.body.genId) {
    if (!/^2021\d*$/.test(req.body.genId)) {
      return next(
        new apiError(
          "genId must start with '2021' and contain only numbers",
          400,
        ),
      );
    }

    const existingRepair = await Repairing.findOne({ genId: req.body.genId });
    if (existingRepair) {
      if (existingRepair.genId != repair.genId) {
        return next(
          new apiError(
            `Repair with genId '${req.body.genId}' already exists`,
            400,
          ),
        );
      }
    }

    repair.genId = req.body.genId;
  }
  if (req.body.components && req.body.components.length > 0) {
    for (const { id: componentId, quantity, remove } of req.body.components) {
      //search in the repair components
      const repairComponent = repair.component.find(
        (comp: any) => comp._id.toString() === componentId,
      );

      if (repairComponent) {
        const inventory = await findInventoryForLine(repairComponent);
        if (!inventory) {
          return next(
            new apiError(
              `Component with name ${repairComponent.name} not found in inventory`,
              404,
            ),
          );
        }

        let qty = 0;
        if (!remove) {
          qty = Number(quantity);
          if (!Number.isFinite(qty) || qty < 0) {
            return next(
              new apiError(
                `Quantity for ${repairComponent.name} must be 0 or more`,
                400,
              ),
            );
          }
        }

        // Quantity 0 removes the line, like remove: true.
        if (qty === 0) {
          stockChanges.push({
            id: String(inventory._id),
            qty: -toMoney(repairComponent.quantity),
          });
          repair.component = repair.component.filter(
            (comp) => comp._id.toString() !== componentId,
          );
          continue;
        }

        const diff = qty - toMoney(repairComponent.quantity);
        if (diff > 0 && inventory.quantity < diff) {
          return next(
            new apiError(
              `Not enough quantity for component with id ${componentId}`,
              400,
            ),
          );
        }
        if (diff !== 0) stockChanges.push({ id: String(inventory._id), qty: diff });
        repairComponent.quantity = qty;
        // Always store LINE TOTAL from current inventory unit price
        repairComponent.price = toMoney(inventory.price) * qty;
      } else {
        // Removing a line that isn't on the repair is a no-op.
        if (remove) continue;

        const inventoryComponent = mongoose.Types.ObjectId.isValid(componentId)
          ? await Inventory.findById(componentId)
          : null;

        if (!inventoryComponent) {
          return next(
            new apiError(
              `Component with ID ${componentId} not found in inventory`,
              404,
            ),
          );
        }
        const qty = Number(quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          return next(
            new apiError(
              `in the add operation the quantity must be greater than zero`,
              400,
            ),
          );
        }

        if (inventoryComponent.quantity < qty) {
          return next(
            new apiError(
              `Not enough quantity for component with ID ${componentId}`,
              400,
            ),
          );
        }

        stockChanges.push({ id: String(componentId), qty });
        const componentPrice = toMoney(inventoryComponent.price) * qty;

        repair.component.push({
          name: inventoryComponent.name,
          quantity: qty,
          price: componentPrice,
          _id: new ObjectId(componentId)
        });
      }
    }
  }

  if (req.body.services && req.body.services.length > 0) {
    // Process each incoming service exactly once to avoid duplicates
    for (const svc of req.body.services) {
      const { id: serviceId, name, price, remove, state } = svc;

      if (serviceId) {
        const repairService = repair.Services.find(
          (comp) => comp._id.toString() === serviceId,
        );
        if (!repairService) {
          return next(
            new apiError(
              `Service with id ${serviceId} not found in the repair`,
              404,
            ),
          );
        }

        if (remove) {
          repair.Services = repair.Services.filter(
            (comp) => comp._id.toString() !== serviceId,
          );
        } else {
          if (name) {
            repairService.name = name;
          }
          // null/undefined = leave price unchanged (do not treat as 0)
          if (price !== undefined && price !== null && price !== "") {
            repairService.price = requireNonNegativeMoney(
              price,
              `Price of service "${repairService.name}"`,
            );
          }
          if (state) {
            repairService.state = state;
          }
        }
      } else {
        // new service — allow price 0
        repair.Services.push({
          name,
          price: requireNonNegativeMoney(price, `Price of service "${name ?? ""}"`),
          state,
        });
      }
    }

    // Recalculate overall service completion; the car is updated after saving.
    const totalServicesCount = repair.Services.length;
    const completedServices = repair.Services.filter(
      (service) => service.state === "completed",
    ).length;
    repair.complete = completedServices === totalServicesCount;
    repair.completedServicesRatio =
      totalServicesCount > 0 ? completedServices / totalServicesCount : 0;
  }
  if (req.body.additions && req.body.additions.length > 0) {
    // Process each incoming addition exactly once to avoid duplicates
    for (const add of req.body.additions) {
      const { id: additionId, name, price, remove } = add;

      if (additionId) {
        const repairAddition = repair.additions.find(
          (comp) => comp._id.toString() === additionId,
        );
        if (!repairAddition) {
          return next(
            new apiError(
              `addition with id ${additionId} not found in the repair`,
              404,
            ),
          );
        }

        if (remove) {
          repair.additions = repair.additions.filter(
            (comp) => comp._id.toString() !== additionId,
          );
        } else {
          if (name) {
            repairAddition.name = name;
          }
          if (price !== undefined && price !== null && price !== "") {
            repairAddition.price = requireNonNegativeMoney(
              price,
              `Price of addition "${repairAddition.name}"`,
            );
          }
        }
      } else {
        // new addition — allow price 0
        repair.additions.push({
          name,
          price: requireNonNegativeMoney(price, `Price of addition "${name ?? ""}"`),
        });
      }
    }
  }

  if (req.body.discount !== undefined && req.body.discount !== null) {
    repair.discount = requireNonNegativeMoney(req.body.discount, "Discount");
  }

  if (req.body.type && req.body.type !== repair.type) {
    if (req.body.type != "periodic" && req.body.type != "nonPeriodic") {
      return next(
        new apiError(`the type must be periodic or nonPeriodic only`, 400),
      );
    }
    if (hasCar) {
      const reCar = await Car.findById(repair.carId);
      if (!reCar) {
        return next(new apiError(`No car for this repair`, 404));
      }
      typeChange = { car: reCar, from: repair.type, to: req.body.type };
    }
    repair.type = req.body.type;
  }

  if (req.body.nextRepairDate) {
    carUpdates.nextRepairDate = req.body.nextRepairDate;
    if (repair.complete) carUpdates.lastRepairDate = new Date();
    repair.nextRepairDate = req.body.nextRepairDate;
  }

  if (req.body.nextRepairDistance) {
    carUpdates.nextRepairDistance = req.body.nextRepairDistance;
    repair.nextRepairDistance = req.body.nextRepairDistance;
  }

  // Handle technicians updates
  if (req.body.technicians && req.body.technicians.length > 0) {
    for (const tech of req.body.technicians) {
      const { workerId, name, remove } = tech;

      if (workerId) {
        const repairTechnician = repair.technicians?.find(
          (t) => t.workerId?.toString() === workerId,
        );

        if (repairTechnician) {
          if (remove) {
            workerCountChanges.push({ workerId, inc: -1 });
            repair.technicians = repair.technicians.filter(
              (t) => t.workerId?.toString() !== workerId,
            );
          } else {
            // Update technician name if provided
            if (name) {
              repairTechnician.name = name;
            }
          }
        } else {
          // Add new technician
          if (!remove) {
            workerCountChanges.push({ workerId, inc: 1 });
            repair.technicians.push({ workerId, name });
          }
        }
      } else {
        // Add new technician without workerId (just name)
        if (!remove && name) {
          repair.technicians.push({ name });
        }
      }
    }
  }
  if (req.body.daysItTake) {
    const expectedDate = new Date();
    if(Number(req.body.daysItTake) > 0){
      expectedDate.setDate(expectedDate.getDate() + parseInt(req.body.daysItTake));
    }
    repair.expectedDate = expectedDate;
  }
  if (req.body.Note1 !== undefined) {
    repair.Note1 = req.body.Note1;
  }
  if (req.body.Note2 !== undefined) {
    repair.Note2 = req.body.Note2;
  }
  if (req.body.distance !== undefined && req.body.distance !== "") {
    carUpdates.distances = req.body.distance;
    repair.distance = req.body.distance;
  }

  // Invoice attribution — only overwrite when the client sends the keys.
  if (hasReceptionInput(req.body)) {
    const receptionEngineer = resolveReceptionEngineer(req.body);
    repair.receptionEngineer = receptionEngineer;
    repair.Reception = receptionEngineer;
  }
  if (hasRepresentativeInput(req.body)) {
    repair.representative = resolveRepresentative(req.body);
  }

  // Always rebuild money from current lines (no incremental drift)
  const { totalPrice } = applyRepairTotals(repair);
  // Old invoices may already have a discount above their subtotal; editing
  // them (a note, a date) stays allowed. Block only edits that make it worse.
  if (
    toMoney(repair.discount) > discountBefore ||
    totalPrice < subtotalBefore
  ) {
    requireValidDiscount(repair.discount, totalPrice);
  } else {
    requireNonNegativeMoney(repair.discount, "Discount");
  }

  // Everything is valid: take/return stock, then save. Undo stock if the save fails.
  const applied = await applyStockChanges(stockChanges);
  try {
    await repair.save();
  } catch (error) {
    await revertStockChanges(applied);
    throw error;
  }

  if (hasCar) {
    try {
      if (typeChange) {
        const { car, from, to } = typeChange;
        if (from == "periodic") car.periodicRepairs = (car.periodicRepairs || 0) - 1;
        else if (from == "nonPeriodic") car.nonPeriodicRepairs = (car.nonPeriodicRepairs || 0) - 1;
        if (to == "periodic") car.periodicRepairs = (car.periodicRepairs || 0) + 1;
        else car.nonPeriodicRepairs = (car.nonPeriodicRepairs || 0) + 1;
        await car.save({ validateBeforeSave: false });
      }
      if (req.body.services && req.body.services.length > 0) {
        await syncCarWithRepair(repair, repair.nextRepairDate);
      }
      if (Object.keys(carUpdates).length > 0) {
        await Car.updateOne({ _id: repair.carId }, { $set: carUpdates });
      }
    } catch (error) {
      console.error(`Repair ${repair._id} saved but car update failed:`, error);
    }
  }

  for (const { workerId, inc } of workerCountChanges) {
    if (!mongoose.Types.ObjectId.isValid(workerId)) continue;
    const worker = await Worker.findById(workerId).select("numberOfRepairs");
    if (worker) {
      await Worker.updateOne(
        { _id: workerId },
        { $set: { numberOfRepairs: Math.max(0, (worker.numberOfRepairs || 0) + inc) } },
      );
    }
  }
  await refreshMonthlyRepairs([...techniciansBefore, ...technicianIds(repair)]);

  res.status(200).json({ data: repair });
};

// Shares the per-repair lock with updateServiceStateById.
export const updateRepair = asyncHandler((req, res, next) =>
  withRepairLock(req.params.id, () => updateRepairHandler(req, res, next)),
);

/*

    component: repairDetails ++,
    Services: services ++,
    additions ++,
    type ++,
    discount ++,
    expectedDate ,
    complete ++,
    completedServicesRatio ++,
    Note1 ++,
    Note2 ++,
    distance ++,
    nextRepairDistance ++,
    nextRepairDate: nextPerDate ++,
*/
export const deleteRepair = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Find repair by ID
  const repair = await Repairing.findById(id);
  if (!repair) {
    return next(new apiError(`there is no repair with this id ${id}`, 404));
  }

  const carNumber = repair.carNumber;

  // Put the parts back on the item they came from. Lines store the
  // inventory id as their _id (older walk-in lines: matched by name).
  const stockChanges = [];
  for (const component of repair.component || []) {
    const inventoryItem = await findInventoryForLine(component);
    if (inventoryItem) {
      stockChanges.push({
        id: String(inventoryItem._id),
        qty: -toMoney(component.quantity),
      });
    } else {
      console.warn(
        `Repair ${id}: inventory item for "${component.name}" no longer exists; its quantity was not restocked.`,
      );
    }
  }
  const applied = await applyStockChanges(stockChanges);

  if (repair.complete) {
    await Car.updateOne({ repairing_id: id }, { $set: { repairing_id: null } });
  }
  // Update car periodic/nonPeriodic repairs count
  if(repair.carId){
    const car = await Car.findById(repair.carId);
    if(car){
      if(repair.type === "periodic"){
        car.periodicRepairs = Math.max(0, car.periodicRepairs - 1);
      } else{
        car.nonPeriodicRepairs = Math.max(0, car.nonPeriodicRepairs - 1);
      }
      await car.save({ validateBeforeSave: false });
    }
  }

  try {
    await repair.deleteOne();
  } catch (error) {
    await revertStockChanges(applied);
    throw error;
  }
  console.log(`Repair document with ID ${id} successfully deleted.`);

  const workerIds = technicianIds(repair);
  for (const workerId of workerIds) {
    const worker = await Worker.findById(workerId).select("numberOfRepairs");
    if (worker) {
      await Worker.updateOne(
        { _id: workerId },
        { $set: { numberOfRepairs: Math.max(0, (worker.numberOfRepairs || 0) - 1) } },
      );
    }
  }
  await refreshMonthlyRepairs(workerIds);

  // Check if all repairs for this car are completed
  const allRepairs = await Repairing.find({ carNumber });
  const allCompleted = allRepairs.every(r => r.complete === true);

  if (allCompleted && allRepairs.length > 0) {
    await Car.findOneAndUpdate(
      { carNumber },
      { State: "Good", repairing: false , completedServicesRatio:1 ,repairing_id:undefined,
        lastRepairDate:undefined,
      },
      { new: true }
    );
    console.log(`Car ${carNumber} status updated to Good with repairing=false`);
  }

  res.status(200).json({ message: "deleted successfully" });
});

// @desc Search repairs by genId, client name, carNumber, or generatedCode
// @Route GET /api/v1/repairing/search/:searchTerm
// @access private
export const searchRepairs = asyncHandler(async (req, res, next) => {
  const { searchTerm } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    let repairs = [];
    let paginationResult;

    // 1. Try to find by genId (exact match)
    const repairByGenId = await Repairing.findOne({ genId: searchTerm });
    if (repairByGenId) {
      repairs = await Repairing.find({ genId: searchTerm });
      paginationResult = {
        currentPage: page,
        limit,
        numberOfPages: Math.ceil(repairs.length / limit),
        totalDocuments: repairs.length,
      };
    }
    // 2. Try to find by client name using searchService (case-insensitive partial match)
    else {
      const { documents: repairsByClient, paginationResult: clientPagination } =
        await searchService({
          Model: Repairing,
          searchString: searchTerm,
          searchFields: ["client"],
          page,
          limit,
          sort: { createdAt: -1 },
        });
      if (repairsByClient.length > 0) {
        repairs = repairsByClient;
        paginationResult = clientPagination;
      }
      // 3. Try to find by carNumber (exact match)
      else {
        const repairsByCarNumber = await Repairing.find({
          carNumber: searchTerm,
        });
        if (repairsByCarNumber.length > 0) {
          repairs = repairsByCarNumber;
          paginationResult = {
            currentPage: page,
            limit,
            numberOfPages: Math.ceil(repairs.length / limit),
            totalDocuments: repairs.length,
          };
        }
        // 4. Try to find by generatedCode (find car first, then repairs by carId)
        else {
          const car = await Car.findOne({ generatedCode: searchTerm });
          if (car) {
            repairs = await Repairing.find({ carId: car._id });
            paginationResult = {
              currentPage: page,
              limit,
              numberOfPages: Math.ceil(repairs.length / limit),
              totalDocuments: repairs.length,
            };
          }
        }
      }
    }

    if (!repairs || repairs.length === 0) {
      return next(
        new apiError(`No repairs found for search term: ${searchTerm}`, 404),
      );
    }

    // Sort by creation date (newest first)
    repairs = repairs.sort(
      (a, b) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any),
    );

    // Add next page to paginationResult
    paginationResult.next =
      paginationResult.currentPage < paginationResult.numberOfPages
        ? paginationResult.currentPage + 1
        : null;

    res.status(200).json({
      results: repairs.length,
      paginationResult,
      data: repairs,
    });
  } catch (error) {
    console.error("Error:", error);
    next(new apiError("Internal Server Error", 500));
  }
});
