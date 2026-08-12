const { Jimp } = require("jimp");
const { v2: cloudinary } = require("cloudinary");
const axios = require("axios");
const Car = require("../models/Car");
const Repairing = require("../models/repairingModel");
const User = require("../models/userModel");
const apiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const ApiFeatures = require("../utils/apiFeatures");
const CategoryCode = require("../models/categoryCode");

const { searchService, searchCarService } = require("./searchService");
const { normalizeCarNumber } = require("../utils/carNumberCheck");
const { removeBgExternal } = require("../utils/backgroundRemover");

// @desc    Add car
// @route   POST /api/v1/Garage/:id
// @access  Private
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

  // Check duplicate carNumber
  const existingCar = await Car.findOne({ carNumber });
  if (existingCar) {
    return next(
      new apiError(
        `There is already a car with the same car number ${carNumber}`,
        400,
      ),
    );
  }

  // Check duplicate chassisNumber
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

  // Check duplicate motorNumber
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

  // Generate car code
  const categoryCode = await CategoryCode.findOne({ category: clientType });
  if (!categoryCode) {
    return next(
      new apiError(`There is no type with this name ${clientType}`, 400),
    );
  }

  let newCarCode;
  if (manually === "True" || manually === "true") {
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

  // Check user exists
  const user = await User.findById(id);
  if (!user) {
    return next(
      new apiError(
        "There is no user for this car, you must add user first",
        404,
      ),
    );
  }

  // Create car
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
    generatedPassword: user.password,
    image: "https://res.cloudinary.com/dcj7fkdub/image/upload/v1777995080/def_ljjwcj.png",
    imagePublicId: "cars/def_img"
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

  res.status(201).json({ data: { newCar, user } });
});

// @desc    Get list of all cars
// @route   GET /api/v1/Garage
// @access  Public
exports.getCars = asyncHandler(async (req, res) => {
  const nonAdminUsers = await User.find({ role: "user" }).select("name");
  const nonAdminUsernames = nonAdminUsers.map((user) => user.name);

  const filter = { ownerName: { $in: nonAdminUsernames } };

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

// @desc    Get specific car by id
// @route   GET /api/v1/Garage/:id
// @access  Public
exports.getCar = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const car = await Car.findById(id);
  if (!car) {
    return next(new apiError(`Can't find car with this id ${id}`, 404));
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

// @desc    Get list of repairing cars
// @route   GET /api/v1/Garage/repairing
// @access  Public
exports.getRepairingCars = asyncHandler(async (req, res, next) => {
  const filter = req.filterObj || { State: "Repair" };

  const documentsCounts = await Car.countDocuments(filter);
  const apiFeatures = new ApiFeatures(Car.find(filter), req.query)
    .paginate(documentsCounts)
    .filter()
    .search()
    .limitFields();

  const { mongooseQuery, paginationResult } = apiFeatures;
  let documents = await mongooseQuery;

  if (!documents) {
    return next(new apiError(`There are no cars in repairs`, 404));
  }

  documents = documents.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  // FIX: use documentsCounts instead of extra Car.find() query
  paginationResult.numberOfPages = Math.ceil(
    documentsCounts / paginationResult.limit,
  );

  res
    .status(200)
    .json({ results: documents.length, paginationResult, data: documents });
});

// @desc    Set car repair state
// @route   PUT /api/v1/Garage/repair/:carNumber
// @access  Private
exports.makeCarInRepair = asyncHandler(async (req, res, next) => {
  const { carNumber } = req.params;
  const { repairing } = req.body;

  if (repairing === undefined || repairing === null) {
    return next(new apiError(`Must provide a value for repairing`, 400));
  }

  const car = await Car.findOneAndUpdate(
    { carNumber },
    { repairing },
    { new: true },
  );

  if (!car) {
    // FIX: was referencing undefined `id`, now uses carNumber
    return next(
      new apiError(`Can't find car with this car number ${carNumber}`, 404),
    );
  }

  res.status(200).json({ data: car });
});

// @desc    Update specific car
// @route   PUT /api/v1/Garage/:id
// @access  Private
exports.updateCar = [
  (req, res, next) => {
    if (req.body.carNumber) {
      req.body.carNumber = normalizeCarNumber(req.body.carNumber);
    }
    next();
  },
  factory.updateOne(Car),
];

// @desc    Search for all cars
// @route   GET /api/v1/Garage/search/:searchString
// @access  Private
exports.searchForallCars = asyncHandler(async (req, res, next) => {
  let { searchString } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // First try to search by generatedCode (exact match)
  const carByCode = await Car.findOne({ generatedCode: searchString });
  
  if (carByCode) {
    // If found by generatedCode, return it
    const documents = [carByCode];
    const paginationResult = {
      currentPage: page,
      limit,
      numberOfPages: 1,
      totalDocuments: 1,
    };
    return res
      .status(200)
      .json({ results: documents.length, paginationResult, data: documents });
  }

  // If not found by generatedCode, search by carNumber
  const { documents, paginationResult } = await searchCarService({
    Model: Car,
    searchString,
    page,
    limit,
  });

  if (!documents.length)
    return next(new apiError(`No car found for "${searchString}"`, 404));

  res
    .status(200)
    .json({ results: documents.length, paginationResult, data: documents });
});

// @desc    Search for repairing cars
// @route   GET /api/v1/Garage/search/repairing/:searchString
// @access  Private
exports.searchForRepairingCars = asyncHandler(async (req, res, next) => {
  let { searchString } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { documents, paginationResult } = await searchCarService({
    Model: Car,
    searchString,
    baseFilter: { State: "Repair" },
    page,
    limit,
  });

  if (!documents.length)
    return next(
      new apiError(`No repairing car found for "${searchString}"`, 404),
    );

  res
    .status(200)
    .json({ results: documents.length, paginationResult, data: documents });
});

// @desc    Delete car
// @route   DELETE /api/v1/Garage/:id
// @access  Private
exports.deleteCar = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

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
    res.status(200).json({ message: "Car deleted successfully" });
  } else {
    await user.deleteOne();
    await expectedCar.deleteOne();
    res.status(200).json({ message: "User and car deleted successfully" });
  }
});

// @desc    get unique brands of car
// @route   get /api/v2/getCarsInDB?brand&category&model&color
// @access  public
exports.getUniqueBrands = asyncHandler(async (req, res, next) => {
  const { brand, category, model, color } = req.query;

  const cleanResults = (arr) => [
    ...new Set(
      arr
        .map((item) => item.replace(/^[-\s]+|[-\s]+$/g, "").trim())
        .filter((item) => item !== ""),
    ),
  ];

  if (!brand) {
    const uniqueBrands = await Car.distinct("brand");
    return res.status(200).json({ data: cleanResults(uniqueBrands) });
  }

  if (brand && !category) {
    const uniqueCategories = await Car.distinct("category", { brand });
    return res.status(200).json({ data: cleanResults(uniqueCategories) });
  }

  if (brand && category && !model) {
    const uniqueModels = await Car.distinct("model", { brand, category });
    return res.status(200).json({ data: cleanResults(uniqueModels) });
  }

  if (brand && category && model && !color) {
    const uniqueColors = await Car.distinct("color", {
      brand,
      category,
      model,
    });
    return res.status(200).json({ data: cleanResults(uniqueColors) });
  }

  if (brand && category && model && color) {
    const cars = await Car.find({ brand, category, model, color });
    return res.status(200).json({ data: cars });
  }

  return next(new apiError("enter the car details", 400));
});

// @desc    set cars images with imagin based on brand , category , model and color
// @route   put /api/v2/setCarImg
// @access  public
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
exports.setCarImg = asyncHandler(async (req, res, next) => {
  const { method, brand, model, category, color, back } = req.body;

  if (!method || !brand || !model || !category || !color) {
    return next(
      new apiError(
        "method, brand, model, category and color are required",
        400,
      ),
    );
  }

  const car = await Car.findOne({ brand, model, category });
  if (!car) {
    return next(
      new apiError(
        `Can't find car with brand: ${brand}, model: ${model}, category: ${category}`,
        404,
      ),
    );
  }
  const user = await User.findOne({ name: car.ownerName });
  if (!user) {
    return next(
      new apiError(`Can't find user for car with id ${car._id}`, 404),
    );
  }

  let result;

  if (method === "generate") {
    const imageUrl = new URL("https://cdn.imagin.studio/getimage");
    Object.entries({
      customer: "img",
      make: brand,
      modelFamily: category,
      modelYear: model,
      modelVariant: back || "sedan",
      paintId: `color-${color}`,
      paintDescription: color,
      countryCode: "EGY",
      zoomType: "fullscreen",
      angle: "28",
      fileType: "png",
    }).forEach(([k, v]) => imageUrl.searchParams.append(k, v));

    const response = await axios.get(imageUrl.toString(), {
      responseType: "arraybuffer",
      headers: { Referer: "https://www.imagin.studio" },
    });

    const image = await Jimp.read(Buffer.from(response.data));
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (px, py, idx) => {
      const r = image.bitmap.data[idx];
      const g = image.bitmap.data[idx + 1];
      const b = image.bitmap.data[idx + 2];
      const a = image.bitmap.data[idx + 3];
      if (a < 200 || (r + g + b) / 3 > 200) {
        image.bitmap.data[idx] = Math.min(255, r + 40);
        image.bitmap.data[idx + 1] = Math.min(255, g + 40);
        image.bitmap.data[idx + 2] = Math.min(255, b + 40);
        image.bitmap.data[idx + 3] = 255;
      }
    });
    const cleanBuffer = await image.getBuffer("image/jpeg");
    const bgRemovedBuffer = await removeBgExternal(cleanBuffer);
    const publicId = `${brand}_${model}_${category}_${color}`
      .toLowerCase()
      .replace(/\s+/g, "-");
    result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "cars",
          public_id: publicId,
          overwrite: true,
          resource_type: "image",
        },
        (error, data) => (error ? reject(error) : resolve(data)),
      );
      stream.end(bgRemovedBuffer);
    });
  } else if (method === "upload") {
    if (!req.file) {
      return next(
        new apiError("Image file is required when method is upload", 400),
      );
    }
    const bgRemovedBuffer = await removeBgExternal(req.file.buffer);

    result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "cars",
          transformation: [
            {
              width: 1920,
              height: 1080,
              crop: "fill",
              gravity: "center",
            },
          ],
        },
        (error, data) => (error ? reject(error) : resolve(data)),
      );
      stream.end(bgRemovedBuffer);
    });
  } else {
    return next(new apiError("method must be generate or upload", 400));
  }

  // Save image URL and publicId to car model
  car.image = result.secure_url;
  car.imagePublicId = result.public_id;
  await car.save({ validateBeforeSave: false });
  // Find the specific car in user's car array and update it
  const userCar = user.car.find((c) => c.id?.toString() === car._id.toString());

  if (userCar) {
    userCar.image = result.secure_url;
    userCar.imagePublicId = result.public_id;
  } else {
    return next(new apiError(`Car not found in user's car list`, 404));
  }

  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    publicId: result.public_id,
    url: result.secure_url,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  });
});
