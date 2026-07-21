const express = require("express");
const router = express.Router();

const {
  createIssue,
  getAllIssues,
  getIssueById,
  getIssuesByUserId,
  updateIssueStatus,
  deleteIssue,
} = require("../services/issueService");
const authService = require("../services/authService");

/**
 * @swagger
 * /issues:
 *   post:
 *     summary: Create a new issue
 *     tags: [Issues]
 *     x-category: app
 *     x-status: "new"
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, platform, app_type, description]
 *             properties:
 *               user_id:
 *                 type: string
 *                 example: "6735c716e41091cfb6b03563"
 *               platform:
 *                 type: string
 *                 enum: [android, ios]
 *                 example: "android"
 *               app_type:
 *                 type: string
 *                 enum: [system, app]
 *                 example: "app"
 *               description:
 *                 type: string
 *                 example: "App crashes when opening the booking screen"
 *     responses:
 *       201:
 *         description: Issue created successfully
 *       400:
 *         description: Validation error
 */
router.post(
  "/",
  authService.protect,
  authService.allowedTo("user", "admin"),
  createIssue,
);

/**
 * @swagger
 * /issues:
 *   get:
 *     summary: Get all issues
 *     tags: [Issues]
 *     x-category: system
 *     x-status: "new"
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all issues
 */
router.get(
  "/",
  authService.protect,
  authService.allowedTo("admin"),
  getAllIssues,
);

/**
 * @swagger
 * /issues/{id}:
 *   get:
 *     summary: Get issue by ID
 *     tags: [Issues]
 *     x-category: system
 *     x-status: "new"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Issue details
 *       404:
 *         description: Issue not found
 */
router.get(
  "/:id",
  authService.protect,
  authService.allowedTo("admin"),
  getIssueById,
);

/**
 * @swagger
 * /issues/user/{userId}:
 *   get:
 *     summary: Get issues by user ID
 *     tags: [Issues]
 *     x-category: app
 *     x-status: "new"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of user's issues
 */
router.get(
  "/user/:userId",
  authService.protect,
  authService.allowedTo("user", "admin"),
  getIssuesByUserId,
);

/**
 * @swagger
 * /issues/{id}:
 *   patch:
 *     summary: Update issue solved status
 *     tags: [Issues]
 *     x-category: system
 *     x-status: "new"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [solved]
 *             properties:
 *               solved:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Issue updated successfully
 *       404:
 *         description: Issue not found
 */
router.patch(
  "/:id",
  authService.protect,
  authService.allowedTo("admin"),
  updateIssueStatus,
);

/**
 * @swagger
 * /issues/{id}:
 *   delete:
 *     summary: Delete issue
 *     tags: [Issues]
 *     x-category: system
 *     x-status: "new"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Issue deleted successfully
 *       404:
 *         description: Issue not found
 */
router.delete(
  "/:id",
  authService.protect,
  authService.allowedTo("admin"),
  deleteIssue,
);

module.exports = router;
