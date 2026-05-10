const crypto = require("crypto");

const jwt = require("jsonwebtoken");

const bcrypt = require("bcryptjs");
const Car = require("../models/Car");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const {
  sendLoginVerificationLink,
  sendTemporaryPassword,
  sendCarCredentials,
  sendOtp,
} = require("./emailService");
const {
  sendRepairDoneNotification,
  sendNeedsCheckNotification,
} = require("./notificationFire");
const createToken = require("../utils/createToken");

const User = require("../models/userModel");
const otpGenerator = require("otp-generator");
const admin = require("../config/fireBase.js");
const { notifyClient } = require("../utils/sse/sseService.js");

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
// @desc    Signup
// @route   GET /api/v1/auth/signup
// @access  Public
exports.signup = asyncHandler(async (req, res, next) => {
  const generatedCode = await generateUniqueCode();
  const generatedPassword = crypto.randomBytes(6).toString("hex").toUpperCase();
  //console.log("generated code", generatedCode);
  //console.log("generated Password", generatedPassword);
  // 1- Create user
  const newCar = await Car.create({
    ownerName: req.body.name,
    carNumber: req.body.carNumber,
    email: req.body.email,
    carIdNumber: req.body.carIdNumber,
    color: req.body.color,
    brand: req.body.brand,
    category: req.body.category,
    model: req.body.model,
    generatedCode: generatedCode,
    generatedPassword: generatedPassword,
  });
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    carNumber: req.body.carNumber,
    phoneNumber: req.body.phoneNumber,
    password: generatedPassword,
    car: [
      {
        id: newCar._id,
        carCode: generatedCode,
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
  // 3) Send the reset code via email
  try {
    await sendCarCredentials({
      email: user.email,
      ownerName: user.name,
      generatedCode: newCar.generatedCode,
      generatedPassword: newCar.generatedPassword,
    });
  } catch (err) {
    return next(new ApiError("There is an error in sending email", 500));
  }
  return res.status(201).json({ data: user, token });
});

// @desc    Login using car code
// @route   GET /api/v1/auth/loginByCarCode
// @access  Public
exports.loginByCarCode = asyncHandler(async (req, res, next) => {
  // Check if carCode and password are provided in the request body
  if (!req.body.carCode || !req.body.password) {
    return next(new ApiError("Car code and password are required", 400));
  }

  // Find the user by carCode and check if password is correct
  const user = await User.findOne({
    car: { $elemMatch: { carCode: req.body.carCode } },
    password: req.body.password,
  });

  if (!user) {
    return next(new ApiError("Incorrect carCode or password", 401));
  }
  if (user.fcmToken) {
    await admin.messaging().subscribeToTopic(user.fcmToken, "all_users");
  }
  let carNumber = 0;
  for (var i = 0; i < user.car.length; i++) {
    if (user.car[i].carCode == req.body.carCode) {
      carNumber = user.car[i].carNumber;
      break;
    }
  }
  if (!carNumber) {
    return next(new ApiError("No car found for the given carCode", 404));
  }
  const car = await Car.findOne({ carNumber });

  if (!car) {
    return next(new ApiError("No car found for the given carCode", 404));
  }
  if (car.State == "Need to check") {
    await sendNeedsCheckNotification(car.carNumber);
  }

  const token = createToken(user._id);

  delete user._doc.password;
  delete user._doc.car;

  // Send response to client side
  res.status(200).json({ data: { user, car }, token });
});

// @desc   make sure the user is logged in
exports.protect = asyncHandler(async (req, res, next) => {
  //check if token exist, if exist get
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(
      new ApiError(
        "You are not login, Please login to get access this route",
        401,
      ),
    );
  }

  //verify token (no change happens, expired token)
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  //check if user exists
  const currentUser = await User.findById(decoded.userId.userId);
  if (!currentUser) {
    return next(
      new ApiError(
        "The user that belong to this token does no longer exist",
        401,
      ),
    );
  }

  // 4) Check if user change his password after token created
  if (currentUser.passwordChangedAt) {
    const passChangedTimestamp = parseInt(
      currentUser.passwordChangedAt.getTime() / 1000,
      10,
    );
    // Password changed after token created (Error)
    if (passChangedTimestamp > decoded.iat) {
      return next(
        new ApiError(
          "User recently changed his password. please login again..",
          401,
        ),
      );
    }
  }

  req.user = currentUser;
  next();
});

// @desc    Authorization (User Permissions)
// ["admin", "user"]
exports.allowedTo = (...roles) =>
  asyncHandler(async (req, res, next) => {
    // 1) access roles
    // 2) access registered user (req.user.role)
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError("You are not allowed to access this route", 403),
      );
    }
    next();
  });
// @desc    Forgot password
// @route   POST /api/v1/auth/forgotPassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  // Find the user by carCode and check if password is correct
  const user = await User.findOne({
    car: { $elemMatch: { carCode: req.body.carCode } },
  });

  if (!user) {
    return next(new ApiError("Incorrect carCode", 401));
  }
  let carNumber = 0;
  let carcode = 0;
  for (var i = 0; i < user.car.length; i++) {
    if (user.car[i].carCode == req.body.carCode) {
      carNumber = user.car[i].carNumber;
      carcode = user.car[i].carCode;
      break;
    }
  }
  if (!carNumber) {
    return next(new ApiError("No car found for the given carCode", 404));
  }
  try {
    await sendTemporaryPassword({
      email: user.email,
      ownerName: user.name,
      carCode: carcode,
      password: user.password,
    });

    res
      .status(200)
      .json({ status: "Success", message: "Reset code sent to email" });
  } catch (err) {
    console.log(err);

    await user.save({ validateBeforeSave: false });
    return next(new ApiError("There is an error in sending email", 500));
  }
});

//function to generate a unique token (for simplicity, using a random string)
const generateUniqueToken = () => {
  return Math.random().toString(36).substr(2, 10);
};

// @desc    Login using mail
// @route   GET /api/v1/auth/system/loginByMail
// @access  Public
exports.loginByMail = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || password !== user.password) {
    return next(new ApiError("Incorrect email or password", 401));
  }

  if (user.vertified === false && email !== "admin") {
    const verifyToken = generateUniqueToken();
    const link = `https://fixer-backend-rtw4.onrender.com/api/V2/auth/admin/verifyLogin?token=${verifyToken}`;

    user.loginToken = {
      token: verifyToken,
      expiresAt: new Date(Date.now() + 3600000),
    };
    await user.save({ validateBeforeSave: false });

    sendLoginVerificationLink({ email, userName: user.name, link }).catch(
      (err) => console.error("Email sending failed:", err.message),
    );

    return res.status(200).json({
      message: "Verification link sent to your email",
      email,
      sseStatus: "pending_verification",
    });
  }

  // User is verified - return successful login
  const authToken = createToken({ userId: user._id });
  user.vertified = false;
  user.save({ validateBeforeSave: false });
  const userResponse = { ...user._doc };
  delete userResponse.password;

  return res.status(200).json({
    message: "Login successful",
    data: { user: userResponse },
    token: authToken,
  });
});

exports.verifyLogin = asyncHandler(async (req, res, next) => {
  const { token } = req.query;

  const user = await User.findOne({ "loginToken.token": token });
  if (!user) {
    return next(new ApiError("User token not found", 404));
  }

  if (Date.now() > user.loginToken.expiresAt.getTime()) {
    user.loginToken = { token: null, expiresAt: null };
    await user.save({ validateBeforeSave: false });
    return next(new ApiError("Login link has expired", 401));
  }

  // CRITICAL: Update verification flag in DB first
  user.vertified = true;
  user.loginToken = { token: null, expiresAt: null };
  await user.save({ validateBeforeSave: false });

  // Generate auth token after DB commit
  const authToken = createToken({ userId: user._id });

  // Prepare user data for response
  const userResponse = { ...user._doc };
  delete userResponse.password;
  delete userResponse.vertified;

  // Emit SSE verification event AFTER DB commit
  notifyClient(user.email, {
    status: "verified",
    token: authToken,
    user: userResponse,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `User ${user.email} verified successfully, SSE notification sent`,
  );

  return res.status(200).json({
    message: "Login successful",
    data: { user: userResponse },
    token: authToken,
  });
});

// @desc    Forgot password for admin
// @route   POST /api/v1/auth/admin/forgotPassword
// @access  private
exports.forgotPasswordForAdmin = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
  });

  if (!user) {
    return next(new ApiError("this email not in the system", 404));
  }
  let otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

  user.passwordResetCode = otp;
  await user.save({ validateBeforeSave: false });

  try {
    await sendOtp({
      email: user.email,
      userName: user.name,
      otp,
    });
    return res
      .status(200)
      .json({ status: "Success", message: "OTP sent to email" });
  } catch (err) {
    console.log(err);
    return next(new ApiError("There was an error in sending email", 500));
  }
});

// @desc    Reset password using OTP
// @route   POST /api/v1/auth/admin/resetPassword
// @access  private
exports.resetPasswordForAdmin = asyncHandler(async (req, res, next) => {
  const { email, otp, newPassword } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return next(new ApiError("This email is not in the system", 404));
  }

  if (otp !== user.passwordResetCode) {
    return next(new ApiError("Invalid OTP", 400));
  }

  user.password = newPassword;
  user.passwordResetCode = undefined;
  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .json({ status: "Success", message: "Password reset successful" });
});

// @desc    Reset password using OTP
// @route   POST /api/v1/auth/admin/resetPassword
// @access  private
exports.setEmailAndPassword = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ApiError(" email and password is required", 400));
  }
  const user = await User.findOne({ email: "admin" });

  if (!user) {
    return next(
      new ApiError("there is no email with admin name in the system", 404),
    );
  }

  user.password = password;
  user.email = email;
  await user.save();

  res.status(200).json({
    status: "Success",
    message: "Email and Password reset successful",
  });
});
