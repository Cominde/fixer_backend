const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const ApiError = require("../utils/apiError");
const Role = require("../models/Role");
const RolePermission = require("../models/RolePermission");
const WorkerPermission = require("../models/WorkerPermission");
const Permission = require("../models/Permission");
const registry = require("../utils/permissions/registry");
const Worker = require("../models/Worker");

/**
 * Get full permission registry
 */
exports.getPermissionRegistry = asyncHandler(async (req, res) => {
  res.status(200).json({ data: registry });
});

/**
 * Get all roles
 */
exports.getAllRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find().sort({ createdAt: -1 });
  
  // Get total permission count from registry
  const totalPermissions = Object.keys(registry).length;
  
  // Get selected permissions for each role
  const rolesWithPermissions = await Promise.all(
    roles.map(async (role) => {
      const rolePermissions = await RolePermission.find({ roleId: role._id });
      const selectedPermissions = rolePermissions.map(rp => rp.permissionKey);
      
      return {
        ...role.toObject(),
        permissionCount: selectedPermissions.length,
        totalPermissions,
        selectedPermissions
      };
    })
  );
  
  res.status(200).json({ results: rolesWithPermissions.length, data: rolesWithPermissions });
});

/**
 * Create a new role
 */
exports.createRole = asyncHandler(async (req, res, next) => {
  const { name, isFullAccess, description } = req.body;

  // Check if role name already exists
  const existingRole = await Role.findOne({ name });
  if (existingRole) {
    return next(new ApiError("Role with this name already exists", 400));
  }

  const role = await Role.create({
    name,
    isFullAccess: isFullAccess || false,
    description,
  });

  res.status(201).json({ data: role });
});

/**
 * Delete a role
 */
exports.deleteRole = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Check if role exists
  const role = await Role.findById(id);
  if (!role) {
    return next(new ApiError("Role not found", 404));
  }

  // Delete role permissions
  await RolePermission.deleteMany({ roleId: id });

  // Delete role
  await Role.findByIdAndDelete(id);

  res.status(204).send();
});

/**
 * Set role permissions
 */
exports.setRolePermissions = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { permissions } = req.body; // Array of permission keys

  // Validate role exists
  const role = await Role.findById(id);
  if (!role) {
    return next(new ApiError("Role not found", 404));
  }

  // Validate all permission keys exist in registry
  const allPermissionKeys = Object.values(registry).reduce((acc, module) => {
    return [...acc, ...Object.keys(module.permissions)];
  }, []);

  const invalidPermissions = permissions.filter(
    (key) => !allPermissionKeys.includes(key),
  );

  if (invalidPermissions.length > 0) {
    return next(
      new ApiError(
        `Invalid permission keys: ${invalidPermissions.join(", ")}`,
        400,
      ),
    );
  }

  // Get existing permissions for this role
  const existingPermissions = await RolePermission.find({ roleId: id });
  const existingKeys = existingPermissions.map(rp => rp.permissionKey);

  // Only add permissions that don't already exist
  const newPermissions = permissions.filter(
    (permissionKey) => !existingKeys.includes(permissionKey)
  );

  // Create new role permissions (only the ones that don't exist)
  const rolePermissions = newPermissions.map((permissionKey) => ({
    roleId: id,
    permissionKey,
  }));

  await RolePermission.insertMany(rolePermissions);

  res.status(200).json({
    message: "Role permissions updated successfully",
    data: rolePermissions,
  });
});

/**
 * Get worker permissions (role defaults + overrides)
 */
exports.getWorkerPermissions = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Validate worker exists
  const worker = await Worker.findById(id).populate("roleId");
  if (!worker) {
    return next(new ApiError("Worker not found", 404));
  }

  // Get role permissions
  let rolePermissions = {};
  if (worker.roleId) {
    const rolePerms = await RolePermission.find({ roleId: worker.roleId._id });
    rolePermissions = rolePerms.reduce((acc, rp) => {
      acc[rp.permissionKey] = true;
      return acc;
    }, {});
  }

  // Get worker overrides
  const workerOverrides = await WorkerPermission.find({ workerId: id });
  const overrides = workerOverrides.reduce((acc, wp) => {
    acc[wp.permissionKey] = wp.granted;
    return acc;
  }, {});

  // Calculate effective permissions
  const effective = { ...rolePermissions };
  for (const [key, granted] of Object.entries(overrides)) {
    effective[key] = granted;
  }

  res.status(200).json({
    roleDefaults: rolePermissions,
    overrides,
    effective,
  });
});

/**
 * Get current worker's permissions (role defaults + overrides)
 */
exports.getMyPermissions = asyncHandler(async (req, res, next) => {
  // Get worker ID from req.user (set by checkPermission middleware)
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
    const workerId =
      decoded.userId && decoded.userId.userId
        ? decoded.userId.userId
        : decoded.userId;

  // Validate worker exists
  const worker = await Worker.findById(workerId).populate("roleId");
  if (!worker) {
    return next(new ApiError("Worker not found", 404));
  }

  // Get role permissions
  let rolePermissions = {};
  if (worker.roleId) {
    const rolePerms = await RolePermission.find({ roleId: worker.roleId._id });
    rolePermissions = rolePerms.reduce((acc, rp) => {
      acc[rp.permissionKey] = true;
      return acc;
    }, {});
  }

  // Get worker overrides
  const workerOverrides = await WorkerPermission.find({ workerId });
  const overrides = workerOverrides.reduce((acc, wp) => {
    acc[wp.permissionKey] = wp.granted;
    return acc;
  }, {});

  // Calculate effective permissions
  const effective = { ...rolePermissions };
  for (const [key, granted] of Object.entries(overrides)) {
    effective[key] = granted;
  }

  // Build response with endpoints from registry
  const permissionsWithEndpoints = {};
  for (const [module, moduleData] of Object.entries(registry)) {
    for (const [key, permData] of Object.entries(moduleData.permissions)) {
      if (effective[key]) {
        permissionsWithEndpoints[key] = {
          label: permData.label,
          endpoints: permData.endpoints || [],
        };
      }
    }
  }

  res.status(200).json({
    workerId,
    role: worker.roleId?.name || null,
    roleDefaults: rolePermissions,
    overrides,
    effective,
    permissions: permissionsWithEndpoints,
  });
});

/**
 * Update worker permission overrides
 */
exports.setWorkerPermissions = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { permissions } = req.body; // Object: { "workers.delete": true, "workers.view": false }

  // Validate worker exists
  const worker = await Worker.findById(id);
  if (!worker) {
    return next(new ApiError("Worker not found", 404));
  }

  // If permissions is empty object, delete all worker permissions
  if (!permissions || Object.keys(permissions).length === 0) {
    await WorkerPermission.deleteMany({ workerId: id });
    return res.status(200).json({
      message: "All worker permissions deleted successfully",
      data: [],
    });
  }

  // Validate all permission keys exist in registry
  const allPermissionKeys = Object.values(registry).reduce((acc, module) => {
    return [...acc, ...Object.keys(module.permissions)];
  }, []);

  const invalidPermissions = Object.keys(permissions).filter(
    (key) => !allPermissionKeys.includes(key),
  );

  if (invalidPermissions.length > 0) {
    return next(
      new ApiError(
        `Invalid permission keys: ${invalidPermissions.join(", ")}`,
        400,
      ),
    );
  }

  // Use bulkWrite with replaceOne to handle duplicates
  const bulkOperations = Object.entries(permissions).map(
    ([permissionKey, granted]) => ({
      replaceOne: {
        filter: { workerId: id, permissionKey },
        replacement: { workerId: id, permissionKey, granted },
        upsert: true,
      },
    }),
  );

  await WorkerPermission.bulkWrite(bulkOperations);

  // Get updated permissions
  const updatedPermissions = await WorkerPermission.find({ workerId: id });

  res.status(200).json({
    message: "Worker permissions updated successfully",
    data: updatedPermissions,
  });
});
