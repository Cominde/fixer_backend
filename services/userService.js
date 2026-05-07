const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const factory = require("./handlersFactory");
const ApiError = require("../utils/apiError");
const { uploadSingleImage } = require("../middlewares/uploadImageMiddleware");
const createToken = require("../utils/createToken");
const User = require("../models/userModel");
const Car = require("../models/Car");
const ApiFeatures = require("../utils/apiFeatures");
const sendEmail = require("../utils/sendEmail");
const CategoryCode = require("../models/categoryCode");
// Upload single image
exports.uploadUserImage = uploadSingleImage("profileImg");

// Function to generate a unique 8-digit code
const generateUniqueCode = async () => {
  let isUnique = false;
  let code;

  // Generate and check until a unique 8-digit code is found
  while (!isUnique) {
    code = Math.floor(10000000 + Math.random() * 90000000).toString();
    const existingCar = await Car.findOne({ generatedCode: code });

    if (!existingCar) {
      isUnique = true;
    }
  }

  return code;
};
// Image processing
exports.resizeImage = asyncHandler(async (req, res, next) => {
  const filename = `user-${uuidv4()}-${Date.now()}.jpeg`;

  if (req.file) {
    await sharp(req.file.buffer)
      .resize(600, 600)
      .toFormat("jpeg")
      .jpeg({ quality: 95 })
      .toFile(`uploads/users/${filename}`);

    // Save image into our db
    req.body.profileImg = filename;
  }

  next();
});

// @desc    Get list of users
// @route   GET /api/v1/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res) => {
  let filter = { role: "user" };
  if (req.filterObj) {
    filter = req.filterObj;
  }

  // Build query to project specific fields
  const documentsCounts = await User.countDocuments();
  const apiFeatures = new ApiFeatures(User.find(filter), req.query)
    .paginate(documentsCounts)
    .filter()
    .search()
    .limitFields();

  const users = await User.find(filter);

  let { mongooseQuery, paginationResult } = apiFeatures;
  const documents = await mongooseQuery;
  const formattedUsers = documents.map((document) => {
    const formattedUser = {
      name: document.name,
      id: document._id,
      phoneNumber: document.phoneNumber,
      createdAt: document.createdAt,
      //cars: user.car.map((car) => ({
      // Map through each car
      //  id: car._id,
      //  carNumber: car.carNumber,
      //  brand: car.brand,
      //  category: car.category,
      //  model: car.model,
      //})),
    };

    return formattedUser;
  });
  sortedRepairs = formattedUsers.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  if (paginationResult.limit > users.length) {
    paginationResult.numberOfPages = 1;
  } else {
    paginationResult.numberOfPages = Math.ceil(
      users.length / paginationResult.limit
    );
  }
  res.status(200).json({
    results: sortedRepairs.length,
    paginationResult,
    data: sortedRepairs,
  });
});

// @desc    Get specific user by id
// @route   GET /api/v1/users/:id
// @access  Private/Admin
exports.getUser = factory.getOne(User);

// @desc    Create user
// @route   POST  /api/v1/users
// @access  Private/Admin
exports.createUser = asyncHandler(async (req, res, next) => {
  const generatedPassword = await generateUniqueCode();
  //const generatedPassword = crypto.randomBytes(6).toString("hex").toUpperCase();
  //console.log("generated code", generatedCode);
  //console.log("generated Password", generatedPassword);
  // 1- Create user
  const { carNumber, clientType } = req.body;
  let newCarCode;
  //const fuser = await Car.findOne({ email });
  //if (fuser) {
  //  return next(new ApiError(`this email is already used ${fuser}`, 400));
  //}
  const existingCar = await Car.findOne({ carNumber });
  if (existingCar) {
    return next(
      new ApiError(
        `There is already a car with the same car number ${carNumber}`,
        400
      )
    );
  }
  if (req.body.manually == "True" || req.body.manually == "true") {
    const categoryCode = await CategoryCode.findOne({ category: clientType });
    if (!categoryCode) {
      return next(
        new ApiError(`There is no type with this name ${clientType}`, 400)
      );
    }
    const carCode = req.body.carCode;
    const parsedCarCode = parseInt(carCode, 10);

    if (isNaN(parsedCarCode) || !Number.isInteger(parsedCarCode)) {
      return next(new ApiError(`Invalid carCode. It must be a number.`, 400));
    }

    newCarCode = categoryCode.code + carCode;
  } else {
    const categoryCode = await CategoryCode.findOne({ category: clientType });
    if (!categoryCode) {
      return next(
        new ApiError(`There is no type with this name ${clientType}`, 400)
      );
    }

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

  const newCar = await Car.create({
    ownerName: req.body.name,
    carNumber: req.body.carNumber,
    chassisNumber: req.body.chassisNumber,
    color: req.body.color,
    brand: req.body.brand,
    category: req.body.category,
    model: req.body.model,
    generatedCode: newCarCode,
    distances: req.body.distances,
    motorNumber: req.body.motorNumber,
    nextRepairDate: req.body.nextRepairDate,
    lastRepairDate: req.body.lastRepairDate,
    periodicRepairs: req.body.periodicRepairs,
    nonPeriodicRepairs: req.body.nonPeriodicRepairs,
  });
  const user = await User.create({
    name: req.body.name,
    carNumber: req.body.carNumber,
    email: req.body.email,
    phoneNumber: req.body.phoneNumber,
    password: generatedPassword,
    car: [
      {
        id: newCar._id,
        carCode: newCarCode,
        carNumber: req.body.carNumber,
        brand: req.body.brand,
        category: req.body.category,
        model: req.body.model,
      },
    ],
    role: req.body.role,
  });

  // 2- Generate token
  const token = createToken(user._id);
  try {
    res.status(201).json({ data: user, newCar, token });
  } catch (err) {
    return next(new ApiError("There is an error", 500));
  }
  // 3) Send the reset code via email
  const message = `Dear ${req.body.name},\n\nYour car has been successfully registered with us.\n\nHere are your credentials:\ncar Code: ${newCarCode}\nPassword: ${generatedPassword}\n\nThank you for choosing our service.\n\nBest regards,\nThe Car Service Center Team`;
  try {
    await sendEmail({
      email: req.body.email,
      subject: "Your password",
      message,
      html: `
      <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Car Registration Details</title>
    <style>
        
        body, h1, p {
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: Arial, sans-serif;
            background-color: #f8f8f8;
            color: #333;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        h1 {
            color: #f68b1e;
            margin-bottom: 20px;
            text-align: center;
        }
        
        p {
            margin-bottom: 20px;
            line-height: 1.6;
            
        }
        
        .credentials {
            background-color: #f68b1e;
            padding: 15px;
            color: white;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .credentials p {
          color: white; 
      }
        .footer {
            background-color: #f8f8f8;
            text-align: center;
            padding: 10px;
            border-top: 1px solid #ddd;
            border-radius: 0 0 8px 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://raw.githubusercontent.com/joeshwoa/fixer_system/main/assets/images/51.png" alt="Logo" style="display: block; margin: 0 auto; max-width: 200px; margin-bottom: 20px;">
        <h1>Car Registration Details</h1>
        <p>Dear ${req.body.name},</p>
        <p>Your car has been successfully registered with us.</p>
        <div class="credentials">
            <p><strong>Car Code:</strong> ${newCarCode}</p>
            <p><strong>Password:</strong> ${generatedPassword}</p>
        </div>
        <p>Thank you for choosing our service.</p>
        <p>Best regards,<br>The Car Service Center Team</p>
    </div>
    <div class="footer">
        &copy; 2024 Car Service Center. All rights reserved.
    </div>
</body>
</html>
`,
    });

    res
      .status(200)
      .json({ status: "Success", message: "Reset code sent to email" });
  } catch (err) {
    return next(new ApiError("There is an error in sending email", 500));
  }
});

// @desc    Update specific user
// @route   PUT /api/v1/users/:id
// @access  Private/Admin
exports.updateUser = factory.updateOne(User);
/*exports.updateUser = asyncHandler(async (req, res, next) => {
  const document = await User.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      profileImg: req.body.profileImg,
      role: req.body.role,
      phoneNumber: req.body.phoneNumber,
    },
    {
      new: true,
    }
  );

  if (!document) {
    return next(new ApiError(`No document for this id ${req.params.id}`, 404));
  }
  res.status(200).json({ data: document });
});
*/
exports.changeUserPassword = asyncHandler(async (req, res, next) => {
  const document = await User.findByIdAndUpdate(
    req.params.id,
    {
      password: await bcrypt.hash(req.body.password, 12),
      passwordChangedAt: Date.now(),
    },
    {
      new: true,
    }
  );

  if (!document) {
    return next(new ApiError(`No document for this id ${req.params.id}`, 404));
  }
  res.status(200).json({ data: document });
});

// @desc    cahnge active of specific user
// @route   post /api/v1/users/:id
// @access  Private/Admin
exports.makeUserUnactive = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { active } = req.body;

  if (active == undefined || active == null) {
    return next(new ApiError(`must make value for active`, 400));
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { active },
    { new: true }
  );

  if (!user) {
    return next(new ApiError(`Can't find user for this id ${id}`, 404));
  }

  res.status(200).json({ data: user });
});

// @desc    Get Logged user data
// @route   GET /api/v1/users/getMe
// @access  Private/Protect
exports.getLoggedUserData = asyncHandler(async (req, res, next) => {
  req.params.id = req.user._id;
  next();
});

// @desc    Update logged user password
// @route   PUT /api/v1/users/updateMyPassword
// @access  Private/Protect
exports.updateLoggedUserPassword = asyncHandler(async (req, res, next) => {
  // 1) Update user password based user payload (req.user._id)
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      password: await bcrypt.hash(req.body.password, 12),
      passwordChangedAt: Date.now(),
    },
    {
      new: true,
    }
  );

  // 2) Generate token
  const token = createToken(user._id);

  res.status(200).json({ data: user, token });
});

// @desc    Update logged user data (without password, role)
// @route   PUT /api/v1/users/updateMe
// @access  Private/Protect
exports.updateLoggedUserData = asyncHandler(async (req, res, next) => {
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
    },
    { new: true }
  );

  res.status(200).json({ data: updatedUser });
});

// @desc    Deactivate logged user
// @route   DELETE /api/v1/users/deleteMe
// @access  Private/Protect
exports.deleteLoggedUserData = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });

  res.status(204).json({ status: "Success" });
});

// @desc    search for user
// @route   get /api/v1/users/search
// @access  Private
exports.searchForUser = asyncHandler(async (req, res, next) => {
  const { searchString } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  let query = User.find();

  if (searchString) {
    const schema = User.schema;
    const paths = Object.keys(schema.paths);
    for (let i = 0; i < paths.length; i++) {
      const orConditions = paths
        .filter(
          (path) =>
            schema.paths[path].instance === "String" && // Filter only string type parameters
            (path === "email" ||
              path === "name" ||
              path === "phoneNumber" ||
              path === "role") // Filter specific fields for search
        )
        .map((path) => ({
          [path]: { $regex: searchString, $options: "i" },
        }));

      query = query.or(orConditions);
    }
  }
  const documents = await query.sort({ createdAt: -1 }).skip(skip).limit(limit);

  if (!documents || documents.length === 0) {
    return next(
      new apiError(
        `No document found for the search string ${searchString}`,
        404
      )
    );
  }
  const totalDocuments = await User.countDocuments(query.getQuery());
  const totalPages = Math.ceil(totalDocuments / limit);

  const formattedUsers = documents.map((user) => {
    const formattedUser = {
      name: user.name,
      id: user._id,
      phoneNumber: user.phoneNumber,
      createdAt: user.createdAt,
      //cars: user.car.map((car) => ({
      // Map through each car
      //  id: car._id,
      //  carNumber: car.carNumber,
      //  brand: car.brand,
      //  category: car.category,
      //  model: car.model,
      //})),
    };

    return formattedUser;
  });
  res.status(200).json({
    results: documents.length,
    paginationResult: {
      currentPage: page,
      limit: limit,
      numberOfPages: totalPages,
    },
    data: formattedUsers,
  });
});

// @desc    get next code number
// @route   get /api/v1/users/carCode/:clientType
// @access  Private
exports.suggestNextCodeNumber = asyncHandler(async (req, res, next) => {
  const clientType = req.params;
  /// code for generate number based on client type after numbers on database
  /*
  const categoryCode = await CategoryCode.findOne({
    category: clientType.clientType,
  });
  if (!categoryCode) {
    return next(
      new ApiError(
        `there is no type with this name ${clientType.clientType}`,
        400
      )
    );
  }
  const regex = new RegExp("^" + categoryCode.code + "\\d+$", "i");
  const latestCar = await Car.findOne({ generatedCode: regex })
    .sort({ generatedCode: -1 })
    .limit(1);

  let newCarCode;
  if (latestCar) {
    const lastNumber = parseInt(
      latestCar.generatedCode.replace(categoryCode.code, "")
    );

    const nextNumber = lastNumber + 1;
    newCarCode = categoryCode.code + nextNumber;
  } else {
    newCarCode = categoryCode.code + "1";
  }

  */
  const categoryCode = await CategoryCode.findOne({
    category: clientType.clientType,
  });
  if (!categoryCode) {
    return next(
      new ApiError(
        `There is no type with this name ${clientType.clientType}`,
        400
      )
    );
  }
  let newCarCode = 0;
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
        newCarCode = i + 1;
        break;
      }
    }

    if (!newCarCode) {
      newCarCode = validCodes.length + 1;
    }
  } else {
    newCarCode = 1;
  }
  res.status(200).json({ data: newCarCode });
});
