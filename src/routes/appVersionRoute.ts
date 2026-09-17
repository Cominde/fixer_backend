const express = require("express");
const router = express.Router();

const {
  getAppVersion,
  putAppVersion,
  createAppVersion,
} = require("../services/appVersionService");
const authService = require("../services/authService");

/**
 * @swagger
 * tags:
 *   name: App Version
 *   description: Mobile app version management
 */

/**
 * @swagger
 * /appVersion:
 *   get:
 *     summary: Get current mobile app version info
 *     tags: [App Version]
 *     security: []
 *     responses:
 *       200:
 *         description: Current app version details
 */
router.route("/").get(getAppVersion);

/**
 * Mutating app-version endpoints — admin only (prevents force-update supply-chain abuse).
 */
router.use(authService.protect);
router.use(authService.allowedTo("admin"));

/**
 * @swagger
 * /appVersion:
 *   put:
 *     summary: Update the app version info
 *     tags: [App Version]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Create initial app version entry
 *     tags: [App Version]
 *     security:
 *       - bearerAuth: []
 */
router.route("/").put(putAppVersion).post(createAppVersion);

/**
 * @swagger
 * /appVersion/{id}:
 *   put:
 *     summary: Update app version by specific ID
 *     tags: [App Version]
 *     security:
 *       - bearerAuth: []
 */
router.route("/:id").put(putAppVersion);

export = router;
