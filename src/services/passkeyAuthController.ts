const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const ApiError = require("../utils/apiError");
const {
  beginPasskeyRegistration,
  finishPasskeyRegistration,
  beginPasskeyLogin,
  finishPasskeyLogin,
  listUserPasskeys,
  revokePasskey,
  beginWorkerPasskeyRegistration,
  finishWorkerPasskeyRegistration,
  beginWorkerPasskeyLogin,
  finishWorkerPasskeyLogin,
} = require("./webauthnService");

const extractUserId = (req, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    next(
      new ApiError(
        "You are not logged in, Please login to get access this route",
        401,
      ),
    );
    return null;
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  return decoded.userId;
};
/**
 * @desc    Begin passkey registration
 * @route   POST /api/V2/auth/admin/passkey/register/begin
 * @access  Private (authenticated admin)
 */
exports.beginRegistration = asyncHandler(async (req, res, next) => {
  const userId = extractUserId(req, next); // 👈
  if (!userId) return;

  const { origin } = req.body;
  if (!origin) return next(new ApiError("Origin is required", 400));

  const options = await beginPasskeyRegistration(userId, origin);
  res.status(200).json({ status: "success", data: options });
});

/**
 * @desc    Finish passkey registration
 * @route   POST /api/V2/auth/admin/passkey/register/finish
 * @access  Private (authenticated admin)
 */
exports.finishRegistration = asyncHandler(async (req, res, next) => {
  const userId = extractUserId(req, next); // 👈
  if (!userId) return;

  const { credential, origin, clientDataJSON } = req.body;
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
  const userId = extractUserId(req, next); // 👈
  if (!userId) return;

  const passkeys = await listUserPasskeys(userId);
  res.status(200).json({ status: "success", data: { passkeys } });
});

/**
 * @desc    Revoke passkey
 * @route   POST /api/V2/auth/admin/passkey/revoke
 * @access  Private (authenticated admin)
 */
exports.revokePasskey = asyncHandler(async (req, res, next) => {
  const userId = extractUserId(req, next); // 👈
  if (!userId) return;

  const { credentialId } = req.body;
  if (!credentialId)
    return next(new ApiError("Credential ID is required", 400));

  const result = await revokePasskey(userId, credentialId);
  res.status(200).json(result);
});

/**
 * @desc    Begin worker passkey registration
 * @route   POST /api/V2/auth/worker/passkey/register/begin
 * @access  Private (authenticated worker)
 */
exports.beginWorkerRegistration = asyncHandler(async (req, res, next) => {
  const userId = extractUserId(req, next);
  if (!userId) return;

  const { origin } = req.body;
  if (!origin) return next(new ApiError("Origin is required", 400));

  const options = await beginWorkerPasskeyRegistration(userId, origin);
  res.status(200).json({ status: "success", data: options });
});

/**
 * @desc    Finish worker passkey registration
 * @route   POST /api/V2/auth/worker/passkey/register/finish
 * @access  Private (authenticated worker)
 */
exports.finishWorkerRegistration = asyncHandler(async (req, res, next) => {
  const userId = extractUserId(req, next);
  if (!userId) return;

  const { credential, origin, clientDataJSON } = req.body;
  if (!credential || !origin || !clientDataJSON) {
    return next(
      new ApiError(
        "Missing required fields: credential, origin, clientDataJSON",
        400,
      ),
    );
  }

  const result = await finishWorkerPasskeyRegistration(
    userId,
    credential,
    origin,
    clientDataJSON,
  );
  res.status(200).json(result);
});

/**
 * @desc    Begin worker passkey login
 * @route   POST /api/V2/auth/worker/passkey/login/begin
 * @access  Public
 */
exports.beginWorkerLogin = asyncHandler(async (req, res, next) => {
  const { phoneNumber, origin } = req.body;

  if (!phoneNumber || !origin) {
    return next(new ApiError("Phone number and origin are required", 400));
  }

  const options = await beginWorkerPasskeyLogin(phoneNumber, origin);

  res.status(200).json({
    status: "success",
    data: options,
  });
});

/**
 * @desc    Finish worker passkey login
 * @route   POST /api/V2/auth/worker/passkey/login/finish
 * @access  Public
 */
exports.finishWorkerLogin = asyncHandler(async (req, res, next) => {
  const { credential, origin, clientDataJSON } = req.body;

  if (!credential || !origin || !clientDataJSON) {
    return next(
      new ApiError(
        "Missing required fields: credential, origin, clientDataJSON",
        400,
      ),
    );
  }

  const result = await finishWorkerPasskeyLogin(credential, origin, clientDataJSON);

  res.status(200).json(result);
});

export {};
