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
const { sendLowQuantityNotification } = require("./notificationFire");
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
  repair.priceAfterDiscount = totalPrice - discount;
  return { totalPrice, priceAfterDiscount: repair.priceAfterDiscount };
};

async function resolveReceptionForRequest(req) {
  if (hasReceptionInput(req.body)) {
    return resolveReceptionEngineer(req.body);
  }
  if (req.user && req.user._id) {
    const worker = await Worker.findById(req.user._id);
    if (worker && worker.name) {
      return sanitizePersonName(worker.name, { fallback: "NA" }) || "NA";
    }
  }
  return "NA";
}

// @desc create a repairing
// @Route POST /api/v1/repairing
// @access private

export const createRepairing = asyncHandler(async (req, res, next) => {
  let totalPrice = 0;
  let totalServicesCount = 0;
  let completedServices = 0;
  let periodicRepairs = 0;
  let nonperiodicRepairs = 0;
  let complete = false;
  let newId: any = 0;
  const const_part_of_id = "2021";
  const {
    components,
    services,
    additions,
    carNumber,
    type,
    discount,
    daysItTake,
    nextRepairDate,
    Note1,
    Note2,
    distance,
    nextRepairDistance,
    technicians,
  } = req.body;

  // For non-periodic repairs or when nextRepairDate/nextRepairDistance are empty, get values from last periodic repair
  let finalDistance = req.body.distance;
  let nextDistance = req.body.nextRepairDistance;
  let nextRDate = req.body.nextRepairDate;
  if (type === "nonPeriodic" || nextRepairDate === "" || nextRepairDistance === "") {
    const lastPeriodicRepair = await Repairing.findOne({
      carNumber: carNumber,
      type: "periodic",
    }).sort({ createdAt: -1 });

    if (lastPeriodicRepair) {
      // Use nextRepairDistance and nextRepairDate from the last periodic repair
      nextDistance = lastPeriodicRepair.nextRepairDistance || 0;
      nextRDate = lastPeriodicRepair.nextRepairDate;
      finalDistance = lastPeriodicRepair.distance || 0;
    } else {
      // No periodic repair found, set to default values
      nextDistance = 0;
      nextRDate = undefined;
      finalDistance = 0;
    }
  }
  if (req.body.manually == "True" || req.body.manually == true) {
    const id = req.body.id;
    const parsedCarCode = parseInt(id, 10);

    if (isNaN(parsedCarCode) || !Number.isInteger(parsedCarCode)) {
      return next(new apiError(`Invalid carCode. It must be a number.`, 400));
    }

    newId = const_part_of_id + parsedCarCode;
    const exRepair = await Repairing.findOne({ genId: newId });
    if (exRepair) {
      return next(
        new apiError(`Repairing with id ${newId} already exists.`, 400),
      );
    }
  } else {
    const regex = new RegExp("^" + const_part_of_id + "\\d+$", "i");

    const repairs = await Repairing.aggregate([
      { $match: { genId: regex } }, //match genId starting with '2021'
      {
        $project: {
          numericCode: {
            $toInt: {
              $substr: [
                "$genId",
                { $strLenCP: const_part_of_id }, //skip 2021
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

    //find the first missing number or create the next newId
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
    const qty = toMoney(quantity);
    const inventoryComponent = await Inventory.findById(id);

    if (!inventoryComponent) {
      return next(
        new apiError(`Component with ID ${id} not found in inventory`, 404),
      );
    }
    if (
      inventoryComponent.quantity < qty ||
      inventoryComponent.quantity < 0
    ) {
      return next(
        new apiError(`Not enough quantity for component with id ${id}`, 400),
      );
    }
    inventoryComponent.quantity -= qty;

    await inventoryComponent.save({ validateBeforeSave: false });

    // Check if quantity is low and send notification to admin
    if (inventoryComponent.quantity < inventoryComponent.alertQuantity) {
      try {
        await sendLowQuantityNotification(
          inventoryComponent.name,
          inventoryComponent.quantity,
        );
      } catch (error) {
        console.error("Failed to send low quantity notification:", error);
      }
    }

    // component.price is always LINE TOTAL (unit × qty)
    const componentPrice = toMoney(inventoryComponent.price) * qty;
    totalPrice += componentPrice;

    repairDetails.push({
      name: inventoryComponent.name,
      quantity: qty,
      price: componentPrice,
      _id : new ObjectId(id)
    });
  }
  /*if (type == "periodic") {
      periodicRepairs += 1;
    } else {
      nonperiodicRepairs += 1;
    }*/

  const reCar = await Car.findOne({ carNumber: carNumber });
  if (!reCar) {
    return next(new apiError(`No car for this number ${carNumber}`, 404));
  }
  periodicRepairs = reCar.periodicRepairs;
  nonperiodicRepairs = reCar.nonPeriodicRepairs;
  if (type == "periodic" || type == "nonPeriodic") {
    if (type == "periodic") {
      periodicRepairs += 1;
    } else {
      nonperiodicRepairs += 1;
    }
  } else {
    return next(
      new apiError(`the type must be periodic or nonPeriodic only`, 400),
    );
  }
  reCar.periodicRepairs = periodicRepairs;
  reCar.nonPeriodicRepairs = nonperiodicRepairs;
  reCar.distances = finalDistance;
  reCar.nextRepairDistance = nextDistance;
  reCar.nextRepairDate = nextRDate;

  const currentDate = new Date();
  const parsedNextPerDate = new Date(nextRDate);
  if (completedServices === totalServicesCount) {
    complete = true;
    const lastRepairDate = new Date();
    reCar.lastRepairDate = lastRepairDate;
    reCar.repairing = !complete
  }

  const completedServicesRatio =
    totalServicesCount > 0 ? completedServices / totalServicesCount : 0;
  const discountAmount = toMoney(discount);
  const priceAfterDiscount = totalPrice - discountAmount;

  let state = "";

  if (!complete) {
    state = "Repair";
  } else if (currentDate < parsedNextPerDate && complete) {
    state = "Good";
  } else {
    state = "Need to check";
  }
  reCar.State = state;
  reCar.completedServicesRatio = completedServicesRatio

  reCar.save();
  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + parseInt(daysItTake));

  const car = await Car.findOne({ carNumber });
  const receptionEngineer = await resolveReceptionForRequest(req);
  const representative = resolveRepresentative(req.body);

  const normalizedServices = (services || []).map((s) => ({
    ...s,
    price: toMoney(s.price),
  }));
  const normalizedAdditions = (additions || []).map((a) => ({
    ...a,
    price: toMoney(a.price),
  }));

  const repair = await Repairing.create({
    client: car.ownerName,
    genId: newId,
    brand: car.brand,
    category: car.category,
    model: car.model,
    component: repairDetails,
    Services: normalizedServices,
    additions: normalizedAdditions,
    carNumber,
    type,
    totalPrice,
    discount: discountAmount,
    priceAfterDiscount,
    expectedDate,
    complete,
    completedServicesRatio,
    Note1,
    Note2,
    distance: finalDistance,
    nextRepairDistance:nextDistance,
    nextRepairDate: nextRDate,
    carId: car._id,
    generatedCode: car.generatedCode,
    technicians: technicians || [],
    Reception: receptionEngineer,
    receptionEngineer,
    representative,
  });

  // Increment numberOfRepairs for each technician

  if (technicians && technicians.length > 0) {
    for (const technician of technicians) {
      const worker = await Worker.findById(technician.workerId);
      if (worker) {
        worker.numberOfRepairs += 1;
        await worker.save();
      }
    }
  }
  if (!complete) {
    const car = await Car.findOneAndUpdate(
      { carNumber: carNumber },
      { repairing_id: repair._id, repairing: true },
      { new: true },
    );

    if (!car) {
      return next(new apiError(`No car for this number ${carNumber}`, 404));
    }
    await car.save();
  }
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
  let totalPrice = 0;
  let totalServicesCount = 0;
  let completedServices = 0;
  let complete = false;
  let newId: any = 0;
  const const_part_of_id = "2021";
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
    technicians,
  } = req.body;

  // Validate required fields
  if (!clientName || !carNumber || !brand || !category || !model) {
    return next(
      new apiError(
        "clientName, carNumber, brand, category, and model are required for walk-in repair",
        400,
      ),
    );
  }

  // Generate genId (same logic as createRepairing)
  if (req.body.manually == "True" || req.body.manually == true) {
    const id = req.body.id;
    const parsedCarCode = parseInt(id, 10);

    if (isNaN(parsedCarCode) || !Number.isInteger(parsedCarCode)) {
      return next(new apiError(`Invalid carCode. It must be a number.`, 400));
    }

    newId = const_part_of_id + parsedCarCode;
    const exRepair = await Repairing.findOne({ genId: newId });
    if (exRepair) {
      return next(
        new apiError(`Repairing with id ${newId} already exists.`, 400),
      );
    }
  } else {
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
    const qty = toMoney(quantity);
    const inventoryComponent = await Inventory.findById(id);

    if (!inventoryComponent) {
      return next(
        new apiError(`Component with ID ${id} not found in inventory`, 404),
      );
    }
    if (
      inventoryComponent.quantity < qty ||
      inventoryComponent.quantity < 0
    ) {
      return next(
        new apiError(`Not enough quantity for component with id ${id}`, 400),
      );
    }
    inventoryComponent.quantity -= qty;
    await inventoryComponent.save({ validateBeforeSave: false });

    // Check if quantity is low and send notification to admin
    if (inventoryComponent.quantity < inventoryComponent.alertQuantity) {
      try {
        await sendLowQuantityNotification(
          inventoryComponent.name,
          inventoryComponent.quantity,
        );
      } catch (error) {
        console.error("Failed to send low quantity notification:", error);
      }
    }

    const componentPrice = toMoney(inventoryComponent.price) * qty;
    totalPrice += componentPrice;

    repairDetails.push({
      name: inventoryComponent.name,
      quantity: qty,
      price: componentPrice,
    });
  }

  const completedServicesRatio =
    totalServicesCount > 0 ? completedServices / totalServicesCount : 0;
  const discountAmount = toMoney(discount);
  const priceAfterDiscount = totalPrice - discountAmount;

  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + parseInt(daysItTake));

  const receptionEngineer = await resolveReceptionForRequest(req);
  const representative = resolveRepresentative(req.body);

  const normalizedServices = (services || []).map((s) => ({
    ...s,
    price: toMoney(s.price),
  }));
  const normalizedAdditions = (additions || []).map((a) => ({
    ...a,
    price: toMoney(a.price),
  }));

  // Create walk-in repair without car reference
  const repair = await Repairing.create({
    client: clientName,
    genId: newId,
    brand: brand,
    category: category,
    model: model,
    component: repairDetails,
    Services: normalizedServices,
    additions: normalizedAdditions,
    carNumber: carNumber,
    type: type || "periodic",
    totalPrice,
    discount: discountAmount,
    priceAfterDiscount,
    expectedDate,
    complete,
    completedServicesRatio,
    Note1,
    Note2,
    distance: toMoney(distance),
    technicians: technicians || [],
    Reception: receptionEngineer,
    receptionEngineer,
    representative,
  });

  // Increment numberOfRepairs for each technician
  if (technicians && technicians.length > 0) {
    for (const technician of technicians) {
      const worker = await Worker.findById(technician.workerId);
      if (worker) {
        worker.numberOfRepairs += 1;
        await worker.save();
      }
    }
  }

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

  const repairingDoc = await Repairing.findOne({ "Services._id": serviceId });

  if (!repairingDoc) {
    return next(
      new apiError(
        `Service with ID ${serviceId} not found in any repairing document`,
        404,
      ),
    );
  }

  const service = repairingDoc.Services.find((s) => s._id.equals(serviceId));

  if (!service) {
    return next(
      new apiError(
        `Service with ID ${serviceId} not found within any repairing document`,
        404,
      ),
    );
  }

  // Update service state
  service.state = newState;

  // Update completed services count and ratio
  const totalServicesCount = repairingDoc.Services.length;
  const completedServices = repairingDoc.Services.filter(
    (s) => s.state === "completed",
  ).length;

  repairingDoc.completedServicesRatio =
    totalServicesCount > 0 ? completedServices / totalServicesCount : 0;

  // Update repair completion status
  repairingDoc.complete = completedServices === totalServicesCount;

  // Save the parent document (repairingDoc) to persist subdocument changes
  await repairingDoc.save();

  // Update car data if all services are completed
  let car = await Car.findById(repairingDoc.carId);

  if (car) {
    if (repairingDoc.complete) {
      const currentDate = new Date();
      car.lastRepairDate = currentDate;

      if (car.nextRepairDate) {
        const parsedNextPerDate = new Date(car.nextRepairDate);
        if (currentDate < parsedNextPerDate) {
          car.State = "Good";
        } else {
          car.State = "Need to check";
        }
      } else {
        car.State = "Good";
      }
    } else {
      car.State = "Repair";
      car.repairing = true;
      car.repairing_id = repairingDoc._id;
    }

    car.completedServicesRatio = repairingDoc.completedServicesRatio;

    // Save the car document
    await car.save();
  }
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
  const { type } = req.body;
  const car = await Car.findById(id);

  if (!car || car.length === 0) {
    const repair = await Repairing.findById(id);
    if (repair) {
      return res.status(200).json({ data: [repair] });
    }

    return next(new apiError(`Can't car with this id ${id}`, 404));
  }

  let query: any = { carId: car._id };

  // Filter by type if specified
  if (type === "periodic") {
    query.type = "periodic";
  } else if (type === "nonPeriodic") {
    query.type = "nonPeriodic";
  }
  // If type is "all" or not specified, return all repairs (no filter)

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
export const suggestNextCodeNumber = asyncHandler(async (req, res, next) => {
  const const_part_of_id = "2021";
  let newId = null;
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

  //find the first missing number or create the next newId
  if (validCodes.length > 0) {
    for (let i = 0; i < validCodes.length; i++) {
      if (validCodes[i] !== i + 1) {
        newId = i + 1;
        break;
      }
    }

    if (!newId) {
      newId = validCodes.length + 1;
    }
  } else {
    newId = "1";
  }

  res.status(200).json({ data: newId });
});

// @desc upadete repair car
// @Route PUT /api/v1/repair/update/:id
// @access private
export const updateRepair = asyncHandler(async (req, res, next) => {
  const repair = await Repairing.findById(req.params.id);

  if (!repair) {
    return next(new apiError(`No repair for this ID: ${req.params.id}`, 404));
  }
  let newComplete = false;
  let diffQuantity = 0;
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
      const qty = toMoney(quantity);
      //search in the repair components
      const repairComponent = repair.component.find(
        (comp) => comp._id.toString() === componentId,
      );
      
      if (repairComponent) {
        const inventory = await Inventory.findOne({
          _id: repairComponent._id,
        });
        if (remove) {
          if (inventory) {
            inventory.quantity += repairComponent.quantity;
            await inventory.save({ validateBeforeSave: false });
          } else {
            return next(
              new apiError(
                `Component with name ${repairComponent.name} not found in inventory`,
                404,
              ),
            );
          }
          //remove the component from the repair
          repair.component = repair.component.filter(
            (comp) => comp._id.toString() !== componentId,
          );
          continue;
        }

        if (!inventory) {
          return next(
            new apiError(
              `Component with name ${repairComponent.name} not found in inventory`,
              404,
            ),
          );
        }

        if (repairComponent.quantity < qty) {
          diffQuantity = qty - repairComponent.quantity;
          inventory.quantity -= diffQuantity;
        } else if (repairComponent.quantity > qty) {
          diffQuantity = repairComponent.quantity - qty;
          inventory.quantity += diffQuantity;
        }
        repairComponent.quantity = qty;
        // Always store LINE TOTAL from current inventory unit price
        repairComponent.price = toMoney(inventory.price) * qty;
        await inventory.save({ validateBeforeSave: false });
      } else {
        const inventoryComponent = await Inventory.findById(componentId);

        if (!inventoryComponent) {
          return next(
            new apiError(
              `Component with ID ${componentId} not found in inventory`,
              404,
            ),
          );
        }
        if (qty === 0) {
          return next(
            new apiError(
              `in the add operation the quantity must be greater than zero`,
              404,
            ),
          );
        }

        if (
          inventoryComponent.quantity < qty ||
          inventoryComponent.quantity < 0
        ) {
          return next(
            new apiError(
              `Not enough quantity for component with ID ${componentId}`,
              400,
            ),
          );
        }

        inventoryComponent.quantity -= qty;
        await inventoryComponent.save({ validateBeforeSave: false });

        // Check if quantity is low and send notification to admin
        if (inventoryComponent.quantity < inventoryComponent.alertQuantity) {
          try {
            await sendLowQuantityNotification(
              inventoryComponent.name,
              inventoryComponent.quantity,
            );
          } catch (error) {
            console.error("Failed to send low quantity notification:", error);
          }
        }

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
            repairService.price = toMoney(price);
          }
          if (state) {
            repairService.state = state;
          }
        }
      } else {
        // new service — allow price 0
        repair.Services.push({
          name,
          price: toMoney(price),
          state,
        });
      }
    }

    // Recalculate overall service completion and update car state once
    const totalServicesCount = repair.Services.length;
    const completedServices = repair.Services.filter(
      (service) => service.state === "completed",
    ).length;
    const completedServicesRatio =
      totalServicesCount > 0 ? completedServices / totalServicesCount : 0;

    newComplete = completedServices === totalServicesCount;
    repair.complete = newComplete;
    repair.completedServicesRatio = completedServicesRatio;

    const currentDate = new Date();
    let state = "";

    if (!newComplete) {
      state = "Repair";
    } else if (
      repair.nextRepairDate &&
      currentDate < new Date(repair.nextRepairDate)
    ) {
      state = "Good";
    } else if (repair.nextRepairDate) {
      state = "Need to check";
    } else {
      state = "Good";
    }

    const car_state = await Car.findByIdAndUpdate(
      repair.carId,
      { State: state },
      { new: true },
    );

    if (!car_state) {
      return next(
        new apiError(`No car for this number ${repair.carNumber}`, 404),
      );
    }
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
            repairAddition.price = toMoney(price);
          }
        }
      } else {
        // new addition — allow price 0
        repair.additions.push({ name, price: toMoney(price) });
      }
    }
  }

  if (req.body.discount !== undefined && req.body.discount !== null) {
    repair.discount = toMoney(req.body.discount);
  }

  if (req.body.type && req.body.type !== repair.type) {
    let periodicRepairs = 0;
    let nonperiodicRepairs = 0;
    const reCar = await Car.findById(repair.carId);
    if (!reCar) {
      return next(new apiError(`No car for this repair`, 404));
    }
    periodicRepairs = reCar.periodicRepairs;
    nonperiodicRepairs = reCar.nonPeriodicRepairs;
    if (req.body.type == "periodic" || req.body.type == "nonPeriodic") {
      if (req.body.type == "periodic") {
        periodicRepairs += 1;
        if (repair.type == "nonPeriodic") {
          nonperiodicRepairs -= 1;
        } else if (repair.type == "periodic") {
          periodicRepairs -= 1;
        }
      } else {
        nonperiodicRepairs += 1;
        if (repair.type == "periodic") {
          periodicRepairs -= 1;
        } else if (repair.type == "nonPeriodic") {
          nonperiodicRepairs -= 1;
        }
      }
    } else {
      return next(
        new apiError(`the type must be periodic or nonPeriodic only`, 400),
      );
    }
    reCar.periodicRepairs = periodicRepairs;
    reCar.nonPeriodicRepairs = nonperiodicRepairs;

    reCar.save();
    repair.type = req.body.type;
  }

  if (req.body.nextRepairDate) {
    if (repair.complete) {
      await Car.findByIdAndUpdate(
        repair.carId,
        {
          lastRepairDate: new Date(),
          nextRepairDate: req.body.nextRepairDate,
        },
        { new: true },
      );
    } else{
      await Car.findByIdAndUpdate(
        repair.carId,
        {
          nextRepairDate: req.body.nextRepairDate,
        },
        { new: true },
      );
    }
    repair.nextRepairDate = req.body.nextRepairDate;
  }

  if (req.body.nextRepairDistance) {
      await Car.findByIdAndUpdate(
        repair.carId,
        { nextRepairDistance: req.body.nextRepairDistance },
        { new: true },
      );
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
            // Remove technician and decrement count
            const worker = await Worker.findById(workerId);
            if (worker) {
              worker.numberOfRepairs = Math.max(0, worker.numberOfRepairs - 1);
              await worker.save();
            }
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
            const worker = await Worker.findById(workerId);
            if (worker) {
              worker.numberOfRepairs += 1;
              await worker.save();
            }
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
    expectedDate.setDate(
      expectedDate.getDate() + parseInt(req.body.daysItTake),
    );
    repair.expectedDate = expectedDate;
  }
  if (req.body.Note1 !== undefined) {
    repair.Note1 = req.body.Note1;
  }
  if (req.body.Note2 !== undefined) {
    repair.Note2 = req.body.Note2;
  }
  if (req.body.distance !== undefined && req.body.distance !== "") {
    repair.distance = toMoney(req.body.distance);
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
  applyRepairTotals(repair);

  await repair.save();

  res.status(200).json({ data: repair });
});

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
    new apiError(`there is no repair with this id ${id}`, 404);
  }

  const carNumber = repair.carNumber;

  // Check if components array is not empty
  if (repair.component && repair.component.length > 0) {
    for (const component of repair.component) {
      const { componentId, quantity } = component;

      const inventoryItem = await Inventory.findOne({ componentId });
      if (inventoryItem) {
        inventoryItem.quantity += quantity;
        await inventoryItem.save({ validateBeforeSave: false });
      } else {
        new apiError(`there is no component with this id ${componentId}`, 404);
      }
    }
  }

  if (repair.complete) {
    const car = await Car.findOne({ repairing_id: id });
    if (car) {
      car.repairing_id = null;
      await car.save();
    }
  }
  if (repair.technicians && repair.technicians.length > 0) {
    for (const technician of repair.technicians) {
      const worker = await Worker.findById(technician.workerId);
      if (worker) {
        worker.numberOfRepairs -= 1;
        await worker.save();
      }
    }
  }
  await repair.deleteOne();
  console.log(`Repair document with ID ${id} successfully deleted.`);

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
