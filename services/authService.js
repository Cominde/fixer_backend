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
  if (!req.body.carCode || !req.body.password) {
    return next(new ApiError("Car code and password are required", 400));
  }

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

  const token = createToken(user._id);
  delete user._doc.password;
  delete user._doc.car;

  // 👇 attach to req before calling next
  req.car = car;
  req.loginResponse = { data: { user, car }, token };

  next();
});

// @desc   make sure the user is logged in
exports.protect = asyncHandler(async (req, res, next) => {
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

  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  //check if user exists
  const userId =
    decoded.userId && decoded.userId.userId
      ? decoded.userId.userId
      : decoded.userId;
  const currentUser = await User.findById(userId);
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
    const link = `https://fixer-backend-rtw4.onrender.com/api/V1/auth/admin/verifyLogin?token=${verifyToken}`;

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
  const authToken = createToken(user._id);
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
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fixer - Error</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #0f0f0f; color: white; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; }
          .card { text-align: center; padding: 40px; }
          .icon { font-size: 60px; margin-bottom: 20px; }
          h2 { color: #ff4444; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">❌</div>
          <h2>Invalid Token</h2>
          <p>This verification link is invalid or already used.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (Date.now() > user.loginToken.expiresAt.getTime()) {
    user.loginToken = { token: null, expiresAt: null };
    await user.save({ validateBeforeSave: false });
    return res.status(401).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fixer - Expired</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #0f0f0f; color: white; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; }
          .card { text-align: center; padding: 40px; }
          .icon { font-size: 60px; margin-bottom: 20px; }
          h2 { color: #ff4444; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">⏰</div>
          <h2>Link Expired</h2>
          <p>This login link has expired. Please request a new one.</p>
        </div>
      </body>
      </html>
    `);
  }

  // Update DB
  user.vertified = true;
  user.loginToken = { token: null, expiresAt: null };
  await user.save({ validateBeforeSave: false });

  const authToken = createToken(user._id);

  const userResponse = { ...user._doc };
  delete userResponse.password;
  delete userResponse.vertified;

  // Notify SSE
  notifyClient(user.email, {
    status: "verified",
    token: authToken,
    user: userResponse,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `User ${user.email} verified successfully, SSE notification sent`,
  );

  // Return success HTML page
  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fixer - Email Verified</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0f0f0f;
          color: white;
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .card {
          text-align: center;
          padding: 40px;
          max-width: 400px;
        }
        .logo {
          width: 100px;
          margin-bottom: 30px;
        }
        .icon-circle {
          background: #2a2a2a;
          border-radius: 50%;
          width: 80px;
          height: 80px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 0 auto 20px;
          font-size: 36px;
        }
        h2 {
          font-size: 24px;
          margin-bottom: 10px;
        }
        p {
          color: #aaa;
          margin-bottom: 5px;
          font-size: 14px;
        }
        .email {
          color: #f5a623;
          font-weight: bold;
          margin-bottom: 15px;
          display: block;
        }
        .status {
          color: #f5a623;
          font-size: 13px;
          margin-bottom: 30px;
        }
        .btn {
          background: #f5a623;
          color: black;
          border: none;
          padding: 15px 40px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          width: 100%;
          margin-bottom: 20px;
        }
        .back {
          color: #aaa;
          font-size: 14px;
          text-decoration: none;
        }
        .back:hover { color: white; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon-circle">✉️</div>
        <h2>Email Verified!</h2>
        <p>You have successfully verified</p>
        <span class="email">${user.email}</span>
        <p class="status">✅ You can now close this tab and return to the app.</p>
      </div>
    </body>
    </html>
  `);
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
