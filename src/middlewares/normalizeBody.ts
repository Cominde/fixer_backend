const ApiError = require("../utils/apiError");

/**
 * Body normalization middleware
 * Converts multipart/form-data to JSON format and normalizes the request body
 * Handles JSON parsing for fields that should be objects/arrays
 */
const normalizeBody = (jsonFields = []) => {
  return (req, res, next) => {
    try {
      // If body is empty or not an object, return early
      if (!req.body || typeof req.body !== 'object') {
        return next();
      }

      // Create a clean copy of the body (handle multer's null prototype)
      const normalizedBody = { ...req.body };

      // Parse JSON fields that should be objects/arrays
      for (const field of jsonFields) {
        if (normalizedBody[field] && typeof normalizedBody[field] === 'string') {
          try {
            normalizedBody[field] = JSON.parse(normalizedBody[field]);
          } catch (e) {
            // If parsing fails, keep as string
            console.warn(`Failed to parse ${field} as JSON:`, e);
          }
        }
      }

      // Remove keys with empty values
      Object.keys(normalizedBody).forEach((key) => {
        const value = normalizedBody[key];
        if (
          value === '' ||
          value === undefined ||
          value === 'undefined' ||
          value === null
        ) {
          delete normalizedBody[key];
        }
      });

      // Handle file attachment if exists
      if (req.file) {
        normalizedBody.file = req.file;
      }

      // Replace req.body with normalized version
      req.body = normalizedBody;

      next();
    } catch (error) {
      next(new ApiError('Body normalization failed', 400));
    }
  };
};

export = normalizeBody;