const Issue = require("../models/issueModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");

// @desc    Create a new issue
// @route   POST /api/v2/issues
// @access  Private
exports.createIssue = asyncHandler(async (req, res, next) => {
  const { user_id, platform, app_type, description } = req.body;

  if (!user_id || !platform || !app_type || !description) {
    return next(new ApiError("Missing required fields", 400));
  }

  const issue = await Issue.create({
    user_id,
    platform,
    app_type,
    description,
    solved: false,
  });

  res.status(201).json({
    status: "success",
    data: issue,
  });
});

// @desc    Get all issues
// @route   GET /api/v2/issues
// @access  Private (admin)
exports.getAllIssues = asyncHandler(async (req, res, next) => {
  const issues = await Issue.find().populate("user_id", "name email");

  res.status(200).json({
    status: "success",
    results: issues.length,
    data: issues,
  });
});

// @desc    Get issue by ID
// @route   GET /api/v2/issues/:id
// @access  Private
exports.getIssueById = asyncHandler(async (req, res, next) => {
  const issue = await Issue.findById(req.params.id).populate("user_id", "name email");

  if (!issue) {
    return next(new ApiError(`No issue found with this id ${req.params.id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: issue,
  });
});

// @desc    Get issues by user ID
// @route   GET /api/v2/issues/user/:userId
// @access  Private
exports.getIssuesByUserId = asyncHandler(async (req, res, next) => {
  const issues = await Issue.find({ user_id: req.params.userId }).populate("user_id", "name email");

  res.status(200).json({
    status: "success",
    results: issues.length,
    data: issues,
  });
});

// @desc    Update issue solved status
// @route   PATCH /api/v2/issues/:id
// @access  Private (admin)
exports.updateIssueStatus = asyncHandler(async (req, res, next) => {
  const { solved } = req.body;

  const issue = await Issue.findByIdAndUpdate(
    req.params.id,
    { solved },
    { new: true, runValidators: true }
  );

  if (!issue) {
    return next(new ApiError(`No issue found with this id ${req.params.id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: issue,
  });
});

// @desc    Delete issue
// @route   DELETE /api/v2/issues/:id
// @access  Private (admin)
exports.deleteIssue = asyncHandler(async (req, res, next) => {
  const issue = await Issue.findByIdAndDelete(req.params.id);

  if (!issue) {
    return next(new ApiError(`No issue found with this id ${req.params.id}`, 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});
