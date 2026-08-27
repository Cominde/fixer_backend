const Booking = require("../models/booking");
const asyncHandler = require("express-async-handler");
const apiError = require("../utils/apiError");
const User = require("../models/userModel");
const Car = require("../models/Car");
const notifyAdmins = require("./notificationFire");

// @desc    create Booking request
// @route   POST /api/v1/Booking/
// @access  Private
exports.createBookingRequest = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { title, description, date, carNumber } = req.body;

  if (!title || !description || !date || !carNumber) {
    return next(
      new apiError(`title, description, date and carNumber are required`, 400),
    );
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new apiError(`there is no user with this id ${userId}`, 404));
  }

  const car = await Car.findOne({ carNumber });
  if (!car) {
    return next(
      new apiError(`there is no car with this number ${carNumber}`, 404),
    );
  }

  const maintenanceRequest = await Booking.create({
    title,
    description,
    date,
    status: "pending",
    user: userId,
    user_name: user.name,
    car: car._id,
    car_number: car.carNumber,
  });

  const notificationResult = await notifyAdmins.notifyAdmins({
    user_name: user.name,
    carNumber: car.carNumber,
    maintenanceRequest: maintenanceRequest,
    title: "new repair request",
    body: `the user ${user.name} ask for new repair request for car with number ${carNumber}`,
  });

  res.status(201).json({
    success: true,
    message: "Maintenance request sent successfully",
    data: maintenanceRequest,
    notification: notificationResult,
  });
});

// @desc    get specific request
// @route   GET /api/v1/Booking/:id
// @access  Private
exports.getSpacificRequest = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const request = await Booking.findById(id);

  if (!request) {
    return next(new apiError(`there is no request with this id ${id}`, 404));
  }

  res.status(200).json({ success: true, data: request });
});

// @desc    cancel the request
// @route   PUT /api/v1/Booking/:id
// @access  Private
exports.cancelRequest = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const request = await Booking.findById(id);

  if (!request) {
    return next(new apiError(`Can't find request for this id ${id}`, 404));
  }

  if (request.user.toString() !== userId.toString()) {
    return next(
      new apiError(`you are not allowed to cancel this request`, 403),
    );
  }

  if (request.status === "cancelled") {
    return next(new apiError(`this request is already cancelled`, 400));
  }

  if (request.status !== "pending") {
    return next(
      new apiError(
        `cannot cancel a request with status "${request.status}"`,
        400,
      ),
    );
  }

  request.status = "cancelled";
  await request.save();

  const notificationResult = await notifyAdmins.notifyAdmins({
    title: "Request cancelled",
    body: `the user ${request.user_name} cancelled the repair request for car with number ${request.car_number}`,
    requestId: request._id,
    type: "maintenance_request_cancelled",
  });

  res.status(200).json({
    success: true,
    message: "Maintenance request cancelled successfully",
    data: request,
    notification: notificationResult,
  });
});

// @desc   get all user requests
// @route   GET /api/v1/Booking/requests/
// @access  Private
exports.getallUserRequests = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const requests = await Booking.find({ user: userId }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, requests });
});
