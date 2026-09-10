const Worker = require("../models/Worker");
const Role = require("../models/Role");
const RolePermission = require("../models/RolePermission");
const WorkerPermission = require("../models/WorkerPermission");
const User = require("../models/userModel");
const ApiError = require("../utils/apiError");
const jwt = require("jsonwebtoken");

/**
 * Check if a user/worker has a specific permission.
 * Handles both authentication and authorization for staff/admin-only routes.
 *
 * Customer-app routes are NOT wrapped in this middleware (Home, getById, etc.)
 * and stay reachable without a token.
 *
 * - No / invalid token → 401 (admin routes require login)
 * - Worker → role / overrides / full-access, else 403
 * - Admin user (role = "admin") → allow
 * - Regular user → 403 (customer token is not enough for staff routes)
 *
 * @param {string} permissionKey - e.g. 'workers.delete'
 * @returns {Function} Express middleware
 */
export const checkPermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      // 1. Authentication - Get and verify token
      let token;
      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer ")
      ) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        return next(
          new ApiError("You are not logged in. Please login to get access", 401),
        );
      }

      // Verify token - if invalid, deny access
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (jwtError) {
        return next(new ApiError("Invalid or expired token", 401));
      }

      // Get user ID from decoded token
      const userId =
        decoded.userId && decoded.userId.userId
          ? decoded.userId.userId
          : decoded.userId;
      // 2. Check if the user is a worker
      const worker = await Worker.findById(userId).populate('roleId');

      if (worker) {
        // Worker permission checking logic
        // If worker has no role, deny access
        if (!worker.roleId) {
          return next(new ApiError("You do not have permission to perform this action", 403));
        }

        // Check if role has full access
        if (worker.roleId.isFullAccess) {
          req.user = worker;
          return next();
        }

        // Check for individual override in WorkerPermission
        const workerOverride = await WorkerPermission.findOne({
          workerId: userId,
          permissionKey: permissionKey,
        });

        if (workerOverride) {
          // Use the override value
          if (workerOverride.granted) {
            req.user = worker;
            return next();
          } else {
            return next(new ApiError("You do not have permission to perform this action", 403));
          }
        }

        // Fall back to role permissions
        const rolePermission = await RolePermission.findOne({
          roleId: worker.roleId._id,
          permissionKey: permissionKey,
        });

        if (rolePermission) {
          req.user = worker;
          return next();
        }

        // No permission found
        return next(new ApiError("You do not have permission to perform this action", 403));
      }

      // 3. If not a worker, check if user exists
      const user = await User.findById(userId);
      
      if (!user) {
        return next(
          new ApiError(
            "The user that belong to this token does no longer exist",
            401,
          ),
        );
      }

      // Check if user is admin
      if (user.role === "admin") {
        // Admin users have full access
        req.user = user;
        return next();
      }

      // Regular user (not admin, not worker) — staff routes only
      return next(
        new ApiError("You do not have permission to perform this action", 403),
      );
    } catch (error) {
      return next(new ApiError(`Error checking permission: ${error.message}`, 500));
    }
  };
};

/**
 * Helper function to check if a worker has a permission (for use in services)
 * @param {string} workerId - The worker ID
 * @param {string} permissionKey - The permission key to check
 * @returns {Promise<boolean>} True if worker has permission
 */
export const workerHasPermission = async (workerId, permissionKey) => {
  try {
    // Fetch worker with role
    const worker = await Worker.findById(workerId).populate('roleId');

    if (!worker || !worker.roleId) {
      return false;
    }

    // Check if role has full access
    if (worker.roleId.isFullAccess) {
      return true;
    }

    // Check for individual override
    const workerOverride = await WorkerPermission.findOne({
      workerId: workerId,
      permissionKey: permissionKey,
    });

    if (workerOverride) {
      return workerOverride.granted;
    }

    // Fall back to role permissions
    const rolePermission = await RolePermission.findOne({
      roleId: worker.roleId._id,
      permissionKey: permissionKey,
    });

    return !!rolePermission;
  } catch (error) {
    console.error("Error checking worker permission:", error);
    return false;
  }
};
