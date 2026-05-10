const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const {
  beginPasskeyRegistration,
  finishPasskeyRegistration,
  beginPasskeyLogin,
  finishPasskeyLogin,
  listUserPasskeys,
  revokePasskey,
} = require("./webauthnService");

/**
 * @desc    Begin passkey registration
 * @route   POST /api/V2/auth/admin/passkey/register/begin
 * @access  Private (authenticated admin)
 */
exports.beginRegistration = asyncHandler(async (req, res, next) => {
  const { origin } = req.body;
  const userId = req.user._id;

  if (!origin) {
    return next(new ApiError("Origin is required", 400));
  }

  const options = await beginPasskeyRegistration(userId, origin);

  res.status(200).json({
    status: "success",
    data: options,
  });
});

/**
 * @desc    Finish passkey registration
 * @route   POST /api/V2/auth/admin/passkey/register/finish
 * @access  Private (authenticated admin)
 */
exports.finishRegistration = asyncHandler(async (req, res, next) => {
  const { credential, origin, clientDataJSON } = req.body;
  const userId = req.user._id;

  if (!credential || !origin || !clientDataJSON) {
    return next(
      new ApiError(
        "Missing required fields: credential, origin, clientDataJSON",
        400,
      ),
    );
  }

  const result = await finishPasskeyRegistration(
    userId,
    credential,
    origin,
    clientDataJSON,
  );

  res.status(200).json(result);
});

/**
 * @desc    Begin passkey login
 * @route   POST /api/V2/auth/admin/passkey/login/begin
 * @access  Public
 */
exports.beginLogin = asyncHandler(async (req, res, next) => {
  const { email, origin } = req.body;

  if (!email || !origin) {
    return next(new ApiError("Email and origin are required", 400));
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new ApiError("Invalid email format", 400));
  }

  const options = await beginPasskeyLogin(email.toLowerCase().trim(), origin);

  res.status(200).json({
    status: "success",
    data: options,
  });
});

/**
 * @desc    Finish passkey login
 * @route   POST /api/V2/auth/admin/passkey/login/finish
 * @access  Public
 */
exports.finishLogin = asyncHandler(async (req, res, next) => {
  const { credential, origin, clientDataJSON } = req.body;

  if (!credential || !origin || !clientDataJSON) {
    return next(
      new ApiError(
        "Missing required fields: credential, origin, clientDataJSON",
        400,
      ),
    );
  }

  const result = await finishPasskeyLogin(credential, origin, clientDataJSON);

  res.status(200).json(result);
});

/**
 * @desc    List user passkeys
 * @route   GET /api/V2/auth/admin/passkey/list
 * @access  Private (authenticated admin)
 */
exports.listPasskeys = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const passkeys = await listUserPasskeys(userId);

  res.status(200).json({
    status: "success",
    data: {
      passkeys,
    },
  });
});

/**
 * @desc    Revoke passkey
 * @route   POST /api/V2/auth/admin/passkey/revoke
 * @access  Private (authenticated admin)
 */
exports.revokePasskey = asyncHandler(async (req, res, next) => {
  const { credentialId } = req.body;
  const userId = req.user._id;

  if (!credentialId) {
    return next(new ApiError("Credential ID is required", 400));
  }

  const result = await revokePasskey(userId, credentialId);

  res.status(200).json(result);
});
