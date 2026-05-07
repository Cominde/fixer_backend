const crypto = require("crypto");

const jwt = require("jsonwebtoken");

const bcrypt = require("bcryptjs");
const Car = require("../models/Car");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const sendEmail = require("../utils/sendEmail");
const createToken = require("../utils/createToken");

const User = require("../models/userModel");
const otpGenerator = require("otp-generator");

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
  const message = `Dear ${user.name},\n\nYour car has been successfully registered with us.\n\nHere are your credentials:\ncar Code: ${newCar.generatedCode}\nPassword: ${newCar.generatedPassword}\n\nThank you for choosing our service.\n\nBest regards,\nThe Car Service Center Team`;
  try {
    await sendEmail({
      email: user.email,
      subject: "Your password",
      message,
    });
    res
      .status(200)
      .json({ status: "Success", message: "Reset code sent to email" });
  } catch (err) {
    return next(new ApiError("There is an error in sending email", 500));
  }
  res.status(201).json({ data: user, token });
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
  // Find the car by carNumber
  const car = await Car.findOne({ carNumber });

  if (!car) {
    return next(new ApiError("No car found for the given carCode", 404));
  }

  // Generate token
  const token = createToken(user._id);

  // Remove password from user object
  delete user._doc.password;
  delete user._doc.car;

  // Send response to client side
  res.status(200).json({ data: { user, car }, token });
});

// @desc   make sure the user is logged in
exports.protect = asyncHandler(async (req, res, next) => {
  // 1) Check if token exist, if exist get
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
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

  // 2) Verify token (no change happens, expired token)
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  // 3) Check if user exists
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
// ["admin", "manager"]
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
  /*
  // Find the car by carNumber
  const car = await Car.findOne({ carNumber });

  if (!car) {
    return next(new ApiError("No car found for the given carCode", 404));
  }*/

  //const { carNumber } = req.body;

  //if (!(car.carNumber === carNumber)) {
  //  return next(new ApiError(`there is no car with this number`, 404));
  //}
  //console.log(user.carCode);
  //console.log(user.password);
  //oldPassword = crypto.de(user.password);
  //console.log(oldPassword);
  // 2) If user exist, Generate hash reset random 6 digits and save it in db
  //const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  //const hashedpassword = crypto
  //  .createHash("sha256")
  //  .update(user.password)
  //  .digest("hex");

  // Save hashed password reset code into db
  //user.passwordResetCode = hashedResetCode;
  // Add expiration time for password reset code (10 min)
  //user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  //user.passwordResetVerified = false;

  //await user.save();
  // 3) Send the reset code via email
  const message = `Dear ${user.name},\n\nHere are your credentials:\ncar Code: ${carcode}\nPassword: ${user.password}\n\nThank you for choosing our service.\n\nBest regards,\nThe Car Service Center Team`;
  try {
    await sendEmail({
      email: user.email,
      subject: "Your old password",
      message,
    });
    res
      .status(200)
      .json({ status: "Success", message: "Reset code sent to email" });
  } catch (err) {
    //user.passwordResetCode = undefined;
    //user.passwordResetExpires = undefined;
    //user.passwordResetVerified = undefined;

    await user.save({ validateBeforeSave: false });
    return next(new ApiError("There is an error in sending email", 500));
  }
});

//function to generate a unique token (for simplicity, using a random string)
const generateUniqueToken = () => {
  return Math.random().toString(36).substr(2, 10);
};

const tokenStore = {};

// @desc    Login using mail
// @route   GET /api/v1/auth/system/loginByMail
// @access  Public
exports.loginByMail = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(password == user.password)) {
    return next(new ApiError("Incorrect email or password", 401));
  }

  const ip = req.connection.remoteAddress;
  const userAgent = req.headers["user-agent"];
  if (user.vertified === false) {
    if (email !== "admin") {
      const token = generateUniqueToken();
      const link = `https://fixer-backend-rtw4.onrender.com/api/V1/auth/admin/verifyLogin?token=${token}`;
      // Store the token with expiration time (1 hour)
      tokenStore[token] = { email, expiresAt: Date.now() + 3600000 };

      const message = `Hello ${user.name},\n\nClick the following link to login:\n${link}\n\nNote: This link will expire in 1 hour.\n\nBest regards,\nThe Car Service Center Team`;

      try {
        // Send email with login link
        await sendEmail({
          email,
          subject: "Login Verification",
          message,
          html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Car Fixing Center</title>
              <style>
                  /* Reset some default browser styles */
                  body, h1, p {
                      margin: 0;
                      padding: 0;
                  }
                  
                  body {
                      font-family: Arial, sans-serif;
                      background-color: #fff68b1e;
                      color: #333;
                  }
                  
                  .container {
                      max-width: 800px;
                      margin: 0 auto;
                      padding: 20px;
                      background-color: #fff;
                      border-radius: 5px;
                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  }
                  
                  h1 {
                      color: #f68b1e;
                      margin-bottom: 20px;
                      text-align: center;
                  }
                  
                  p {
                      margin-bottom: 20px;
                  }
                  
                  .login-button {
                      display: block;
                      width: 200px;
                      margin: 0 auto;
                      padding: 10px;
                      background-color: #f68b1e;
                      color: white;
                      text-align: center;
                      border: none;
                      border-radius: 5px;
                      text-decoration: none;
                      font-size: 16px;
                  }
                  
                  .footer {
                      background-color: #f0f2f5;
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
                  <h1>Car Fixing Center</h1>
                  <p>Click the button below to login. Note: This link will expire in 1 hour.</p>
                  <a href="${link}" class="login-button">Login</a>
              </div>
              <div class="footer">
                  &copy; 2024 Car Fixing Center. All rights reserved.
              </div>
          </body>
          </html>`,
        });
      } catch (err) {
        return next(new ApiError("There was an error in sending email", 500));
      }

      res.status(200).json({ message: "Login link sent to your email" });
    } else {
      const token = createToken({ userId: user._id });

      delete user._doc.password;
      user.vertified = false;
      await user.save();
      delete user._doc.vertified;
      res.status(200).json({ data: { user }, token });
    }
  } else {
    const token = createToken({ userId: user._id });

    delete user._doc.password;
    ///////////////////////////////////////////////////////////////////////////
    // change the vertified before the final submition
    //////////////////////////////////////////////////////////////////////////
    user.vertified = false;
    await user.save();
    delete user._doc.vertified;
    res.status(200).json({ data: { user }, token });
  }
});

// Verification route for login
exports.verifyLogin = asyncHandler(async (req, res, next) => {
  const { token } = req.query;

  // Check if token exists in tokenStore and not expired
  if (!tokenStore[token] || Date.now() > tokenStore[token].expiresAt) {
    return next(new ApiError("Login link is invalid or expired", 401));
  }

  const { email } = tokenStore[token];
  const user = await User.findOne({ email });
  if (!user.vertified) {
    user.vertified = true;
  }
  await user.save();
  delete tokenStore[token];

  res.status(200).json({ message: "Login successful" });
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
  await user.save();

  // Compose email message with the OTP
  const message = `Dear ${user.name},\n\nHere is your OTP for resetting the password: ${otp}\n\nBest regards,\nThe Car Service Center Team`;

  try {
    // Send email with OTP
    await sendEmail({
      email: user.email,
      subject: "Reset Password OTP",
      message,
      html: `
      <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password OTP</title>
    <style>
        /* Reset some default browser styles */
        body, h1, p {
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: Arial, sans-serif;
            background-color: #f0f2f5;
            color: #1c1e21;
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
        
        .otp-code {
            background-color: #f68b1e; /* Adjusted color */
            padding: 10px 20px;
            border-radius: 5px;
            text-align: center;
            font-size: 18px;
            margin-bottom: 20px;
            color: white; /* Adjusted text color */
        }
        
        .footer {
            background-color: #f0f2f5;
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
        <h1>Reset Password OTP</h1>
        <p>Dear ${user.name},</p>
        <p>Here is your OTP for resetting the password:</p>
        <div class="otp-code">${otp}</div>
        <p>Please use this OTP to proceed with the password reset.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Best regards,<br>The Car Service Center Team</p>
    </div>
    <div class="footer">
        &copy; 2024 Car Service Center. All rights reserved.
    </div>
</body>
</html>
`,
    });

    res.status(200).json({ status: "Success", message: "OTP sent to email" });
  } catch (err) {
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
  await user.save();

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
