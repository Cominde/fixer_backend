const appVersion = require("../models/appVersion");
//const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");

/// @desc    create app version
// @route   create /api/v1/Garage/appVersion
// @access  Private

exports.createAppVersion = asyncHandler(async (req, res, next) => {
  const { version } = req.body;
  const savedversion = await appVersion.create({
    version,
  });

  if (!savedversion) {
    return next(new apiError(`there is no version look like this  `, 404));
  }

  res.status(201).json(savedversion);
});

/// @desc    get app version
// @route   get /api/v1/Garage/appVersion/:id
// @access  Private

exports.getAppVersion = asyncHandler(async (req, res, next) => {
  //const { id } = req.params;
  const savedversion = await appVersion.find();

  if (!savedversion) {
    return next(new apiError(`there is no version look like this  `, 404));
  }

  res.status(200).json(savedversion);
});

// @desc    put app version
// @route   put /api/v1/Garage/appVersion/:id
// @access  Private

exports.putAppVersion = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { newAppVersion } = req.body;
  const appversion = await appVersion.findByIdAndUpdate(
    id,
    { version: newAppVersion },
    { new: true }
  );

  if (!appversion) {
    return next(new apiError(`Can't find version for this id ${id}`, 404));
  }

  res.status(200).json(appversion);
});
