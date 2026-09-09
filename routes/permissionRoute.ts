const express = require("express");
const router = express.Router();

const {
  getPermissionRegistry,
  getAllRoles,
  createRole,
  deleteRole,
  setRolePermissions,
  getWorkerPermissions,
  setWorkerPermissions,
  getMyPermissions,
} = require("../services/permissionService");

const { checkPermission } = require("../middlewares/checkPermission");

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: Permission and role management (Admin only)
 */

/**
 * @swagger
 * /permissions/registry:
 *   get:
 *     summary: Get full permission registry
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permission registry grouped by module
 */
router
  .route("/registry")
  .get(checkPermission("permissions.roles.view"), getPermissionRegistry);

/**
 * @swagger
 * /permissions/roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all roles
 *   post:
 *     summary: Create a new role
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Technician"
 *               isFullAccess:
 *                 type: boolean
 *                 default: false
 *               description:
 *                 type: string
 *                 example: "Can perform basic repair tasks"
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Role name already exists
 */
router
  .route("/roles")
  .get(checkPermission("permissions.roles.view"), getAllRoles)
  .post(checkPermission("permissions.roles.create"), createRole);

/**
 * @swagger
 * /permissions/roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "6734de56e41091cfb6b02f7e"
 *     responses:
 *       204:
 *         description: Role deleted successfully
 *       404:
 *         description: Role not found
 */
router
  .route("/roles/:id")
  .delete(checkPermission("permissions.roles.edit"), deleteRole);

/**
 * @swagger
 * /permissions/roles/{id}/permissions:
 *   put:
 *     summary: Set role permissions
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "6734de56e41091cfb6b02f7e"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["workers.view", "repairs.add", "repairs.edit"]
 *     responses:
 *       200:
 *         description: Role permissions updated successfully
 *       404:
 *         description: Role not found
 */
router
  .route("/roles/:id/permissions")
  .put(checkPermission("permissions.roles.edit"), setRolePermissions);

/**
 * @swagger
 * /permissions/workers/{id}/permissions:
 *   get:
 *     summary: Get worker permissions (role defaults + overrides)
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "6734de56e41091cfb6b02f7e"
 *     responses:
 *       200:
 *         description: Worker permissions with role defaults and overrides
 *       404:
 *         description: Worker not found
 *   put:
 *     summary: Update worker permission overrides
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "6734de56e41091cfb6b02f7e"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *                 example:
 *                   "workers.delete": true
 *                   "workers.salary.view": false
 *     responses:
 *       200:
 *         description: Worker permissions updated successfully
 *       404:
 *         description: Worker not found
 */
router
  .route("/workers/:id/permissions")
  .get(checkPermission("permissions.workers.permissions.view"), getWorkerPermissions)
  .put(checkPermission("permissions.workers.permissions.edit"), setWorkerPermissions);

/**
 * @swagger
 * /permissions/my-permissions:
 *   get:
 *     summary: Get current worker's permissions
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current worker's permissions with role defaults and overrides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workerId:
 *                   type: string
 *                 role:
 *                   type: string
 *                   nullable: true
 *                 roleDefaults:
 *                   type: object
 *                   additionalProperties:
 *                     type: boolean
 *                 overrides:
 *                   type: object
 *                   additionalProperties:
 *                     type: boolean
 *                 effective:
 *                   type: object
 *                   additionalProperties:
 *                     type: boolean
 *                   description: Final permissions after applying overrides
 *       404:
 *         description: Worker not found
 */
router.get("/my-permissions", getMyPermissions);

export = router;
