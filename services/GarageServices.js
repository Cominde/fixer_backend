const Car = require("../models/Car");
const Repairing = require("../models/repairingModel");
const User = require("../models/userModel");
//const slugify = require("slugify");
const apiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const ApiFeatures = require("../utils/apiFeatures");
const CategoryCode = require("../models/categoryCode");
const { normalizeCarNumber } = require("../utils/carNumberCheck");

// @desc add car
// @Route GET /api/v1/Garage
// @access private
exports.addCar = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const carNumber = normalizeCarNumber(req.body.carNumber);
  const {
    chassisNumber,
    color,
    brand,
    category,
    model,
    nextRepairDate,
    lastRepairDate,
    periodicRepairs,
    nonPeriodicRepairs,
    distances,
    motorNumber,
    clientType,
    manually,
  } = req.body;

  let newCarCode;

  const existingCar = await Car.findOne({ carNumber });
  if (existingCar) {
    return next(
      new apiError(
        `There is already a car with the same car number ${carNumber}`,
        400,
      ),
    );
  }

  if (chassisNumber) {
    const existingCarWithChassis = await Car.findOne({ chassisNumber });
    if (existingCarWithChassis) {
      return next(
        new apiError(
          `There is already a car with the same chassis number ${chassisNumber}`,
          400,
        ),
      );
    }
  }

  if (motorNumber) {
    const existingCarWithMotor = await Car.findOne({ motorNumber });
    if (existingCarWithMotor) {
      return next(
        new apiError(
          `There is already a car with the same motor number ${motorNumber}`,
          400,
        ),
      );
    }
  }

  const categoryCode = await CategoryCode.findOne({ category: clientType });
  if (!categoryCode) {
    return next(
      new apiError(`There is no type with this name ${clientType}`, 400),
    );
  }

  if (manually === true || manually === "true") {
    const carCode = req.body.carCode;
    const parsedCarCode = parseInt(carCode, 10);
    if (isNaN(parsedCarCode) || !Number.isInteger(parsedCarCode)) {
      return next(new apiError(`Invalid carCode. It must be a number.`, 400));
    }
    newCarCode = categoryCode.code + carCode;
  } else {
    const regex = new RegExp("^" + categoryCode.code + "\\d+$", "i");

    const cars = await Car.aggregate([
      { $match: { generatedCode: regex } },
      {
        $project: {
          numericCode: {
            $toInt: {
              $substr: [
                "$generatedCode",
                { $strLenCP: categoryCode.code },
                { $strLenCP: "$generatedCode" },
              ],
            },
          },
        },
      },
    ]);

    const validCodes = cars
      .map((car) => car.numericCode)
      .filter((num) => !isNaN(num) && num > 0)
      .sort((a, b) => a - b);

    if (validCodes.length > 0) {
      for (let i = 0; i < validCodes.length; i++) {
        if (validCodes[i] !== i + 1) {
          newCarCode = categoryCode.code + (i + 1);
          break;
        }
      }
      if (!newCarCode) {
        newCarCode = categoryCode.code + (validCodes.length + 1);
      }
    } else {
      newCarCode = categoryCode.code + "1";
    }
  }

  const user = await User.findById(id);
  if (!user) {
    return next(
      new apiError(
        "There is no user for this car, you must add user first",
        404,
      ),
    );
  }

  const existingCarCode = await Car.findOne({ generatedCode: newCarCode });
  if (existingCarCode) {
    return next(new apiError(`Car code ${newCarCode} already exists`, 400));
  }

  const newCar = await Car.create({
    ownerName: user.name,
    carNumber,
    chassisNumber: req.body.chassisNumber,
    color,
    brand,
    category,
    model,
    nextRepairDate,
    lastRepairDate,
    periodicRepairs,
    nonPeriodicRepairs,
    componentState: req.body.componentState,
    distances,
    motorNumber,
    generatedCode: newCarCode,
  });

  if (!newCar) {
    return next(new apiError(`Can't create car in database`, 500));
  }

  user.car.push({
    id: newCar._id,
    carCode: newCarCode,
    carNumber,
    brand,
    category,
    model,
  });

  await user.save({ validateBeforeSave: false });

  return res.status(201).json({ data: { newCar, user } });
});

// @desc Search for a car by car number
// @Route GET /api/v1/Garage/:carNumber
// @access private
/*exports.searchCarByNumber = asyncHandler(async (req, res, next) => {
  const { carNumber } = req.params;

  const car = await Car.findOne({ carNumber });

  if (!car) {
    return next(
      new apiError(`Can't find car for this car Number ${carNumber}`, 404)
    );
  }

  res.status(201).json({ data: car });
});*/

// @desc Get list of all Cars
// @Route GET /api/v1/Garage
// @access public
exports.getCars = asyncHandler(async (req, res) => {
  const nonAdminUsers = await User.find({ role: "user" }).select("name");
  const nonAdminUsernames = nonAdminUsers.map((user) => user.name);

  let filter = { ownerName: { $in: nonAdminUsernames } };

  const documentsCounts = await Car.countDocuments(filter);
  const apiFeatures = new ApiFeatures(Car.find(filter), req.query)
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

// @desc spacific car by id
// @Route GET /api/v1/Garage/:id
// @access public
exports.getCar = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const car = await Car.findById(id);

  if (!car) {
    return next(new apiError(`Can't find car with this id  ${id}`, 404));
  }

  const repairing = await Repairing.findOne({
    carNumber: { $in: car.carNumber },
    complete: true,
  });
  const currentRepair = await Repairing.findOne({
    carNumber: { $in: car.carNumber },
    complete: false,
  });
  res.status(200).json({ data: { car, repairing, currentRepair } });
});

// @desc Get list of repairing Cars
// @Route GET /api/v1/Garage/repairing
// @access public
exports.getRepairingCars = asyncHandler(async (req, res, next) => {
  let filter = { State: "Repair" };
  if (req.filterObj) {
    filter = req.filterObj;
  }

  const documentsCounts = await Car.countDocuments();
  const apiFeatures = new ApiFeatures(Car.find(filter), req.query)
    .paginate(documentsCounts)
    .filter()
    .search()
    .limitFields();

  let { mongooseQuery, paginationResult } = apiFeatures;
  let documents = await mongooseQuery;

  documents = documents.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
  const cars = await Car.find(filter);
  if (paginationResult.limit > cars.length) {
    paginationResult.numberOfPages = 1;
  } else {
    paginationResult.numberOfPages = Math.ceil(
      cars.length / paginationResult.limit,
    );
  }
  /*let filter2 = { State: "Repair" };
  if (req.filterObj) {
    filter = req.filterObj;
  }
  const documentsCounts2 = await Car.countDocuments();
  const apiFeatures2 = new ApiFeatures(Car.find(filter2), req.query)
    .paginate(documentsCounts2)
    .filter()
    .search()
    .limitFields();

  const { mongooseQuery2, paginationResult2 } = apiFeatures2;
  let documents2 = await mongooseQuery2;
*/
  if (documents) {
    res
      .status(200)
      .json({ results: documents.length, paginationResult, data: documents });
  } else {
    return next(new apiError(`there is no cars in repaires`, 404));
  }
});

// @desc Search for a car by car number
// @Route GET /api/v1/Garage/:carNumber
// @access private
exports.makeCarInRepair = asyncHandler(async (req, res, next) => {
  const { carNumber } = req.params;
  const { repairing } = req.body;

  if (repairing == undefined || repairing == null) {
    return next(new apiError(`must make value for repairing`, 400));
  }

  const car = await Car.findOneAndUpdate(
    { carNumber },
    { repairing },
    { new: true },
  );

  if (!car) {
    return next(new apiError(`Can't find product for this id ${id}`, 404));
  }

  res.status(200).json({ data: car });
});

// @desc upadete spacific car
// @Route PUT /api/v1/Garage/:id
// @access private
exports.updateCar = factory.updateOne(Car);

// @desc    search for cars
// @route   get /api/v1/Garage/search
// @access  Private
exports.searchForallCars = asyncHandler(async (req, res, next) => {
  const { searchString } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  let query = Car.find();

  if (searchString) {
    const schema = Car.schema;
    const paths = Object.keys(schema.paths);
    /*console.log("Path Types:");
    paths.forEach((path) => {
      console.log(`${path}: ${schema.paths[path].instance}`);
    });*/
    for (let i = 0; i < paths.length; i++) {
      const orConditions = paths
        .filter(
          (path) =>
            schema.paths[path].instance === "String" && //filter only string type parameters
            (path === "ownerName" ||
              path === "carNumber" ||
              path === "chassisNumber" ||
              path === "model" ||
              path === "brand" ||
              path === "motorNumber" ||
              path === "generatedCode"), //filter specific fields for search
        )
        .map((path) => ({
          [path]: { $regex: searchString, $options: "i" },
        }));

      //add or condition to the query
      query = query.or(orConditions);
    }
  }
  const documents = await query
    .sort({ lastRepairDate: -1 })
    .skip(skip)
    .limit(limit);

  if (!documents || documents.length === 0) {
    return next(
      new apiError(
        `No document found for the search string ${searchString}`,
        404,
      ),
    );
  }
  const totalDocuments = await Car.countDocuments(query.getQuery());
  const totalPages = Math.ceil(totalDocuments / limit);
  res.status(200).json({
    results: documents.length,
    paginationResult: {
      currentPage: page,
      limit: limit,
      numberOfPages: totalPages,
    },
    data: documents,
  });
});

// @desc    search for reparing cars
// @route   get /api/v1/Garage/search/repairing/:searchString
// @access  Private
exports.searchForRepairingCars = asyncHandler(async (req, res, next) => {
  const { searchString } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  let query = Car.find({ State: "Repair" });

  if (searchString) {
    const schema = Car.schema;
    const paths = Object.keys(schema.paths);

    const orConditions = paths
      .filter(
        (path) =>
          schema.paths[path].instance === "String" &&
          (path === "ownerName" ||
            path === "carNumber" ||
            path === "chassisNumber" ||
            path === "model" ||
            path === "brand" ||
            path === "motorNumber" ||
            path === "generatedCode"),
      )
      .map((path) => ({
        [path]: { $regex: searchString, $options: "i" },
      }));

    query = query.or(orConditions);
  }

  const documents = await query
    .sort({ lastRepairDate: -1 })
    .skip(skip)
    .limit(limit);

  if (!documents || documents.length === 0) {
    return next(
      new apiError(
        `No document found for the search string "${searchString}"`,
        404,
      ),
    );
  }

  const totalDocuments = await Car.countDocuments(query.getQuery());
  const totalPages = Math.ceil(totalDocuments / limit);
  res.status(200).json({
    results: documents.length,
    paginationResult: {
      currentPage: page,
      limit: limit,
      numberOfPages: totalPages,
    },
    data: documents,
  });
});

// @desc    delete car
// @route   get /api/v1/Garage/delte/:id
// @access  Private

exports.deleteCar = asyncHandler(async (req, res, next) => {
  const id = req.params.id;

  const expectedCar = await Car.findById(id);
  if (!expectedCar) {
    return next(new apiError(`Can't find car with this id ${id}`, 404));
  }

  const user = await User.findOne({ name: expectedCar.ownerName });
  if (!user) {
    return next(new apiError(`Can't find owner for this car`, 404));
  }
  if (user.car.length > 1) {
    user.car = user.car.filter((c) => c.carNumber !== expectedCar.carNumber);
    await user.save({ validateBeforeSave: false });

    await expectedCar.deleteOne();

    res.status(200).json(`Car deleted successfully`);
  } else {
    await user.deleteOne();
    await expectedCar.deleteOne();
    res.status(200).json(`The user deleted successfully `);
  }
});
