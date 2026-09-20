const ApiError = require("../utils/apiError");

const sendErrorForDev = (err, res) =>
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });

const sendErrorForProd = (err, res) =>
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });

const handleJwtInvalidSignature = () =>
  new ApiError("Invalid token, please login again..", 401);

const handleJwtExpired = () =>
  new ApiError("Expired token, please login again..", 401);

const handleCastError = () => new ApiError("Resource not found", 404);

const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new ApiError('File size too large (max 8MB)', 400);
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new ApiError('Too many files uploaded', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new ApiError('Unexpected file field', 400);
  }
  return new ApiError(`File upload error: ${err.message}`, 400);
};

const globalError = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  
  if (err.name === "CastError") err = handleCastError();
  if (err.name === "MulterError") err = handleMulterError(err);
  
  if (process.env.NODE_ENV === "development") {
    sendErrorForDev(err, res);
  } else {
    if (err.name === "JsonWebTokenError") err = handleJwtInvalidSignature();
    if (err.name === "TokenExpiredError") err = handleJwtExpired();
    sendErrorForProd(err, res);
  }
};

export = globalError;
