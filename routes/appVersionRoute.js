const express = require("express");
const router = express.Router();

const {
  getAppVersion,
  putAppVersion,
  createAppVersion,
} = require("../services/appVersionService");

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     version:
 *                       type: string
 *                       example: "2.0.0"
 *                     forceUpdate:
 *                       type: boolean
 *                       example: false
 *                     updateMessage:
 *                       type: string
 *                       example: "تحديث جديد متاح"
 *   put:
 *     summary: Update the app version info
 *     tags: [App Version]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               version:
 *                 type: string
 *                 example: "2.1.0"
 *               forceUpdate:
 *                 type: boolean
 *                 example: true
 *               updateMessage:
 *                 type: string
 *                 example: "يرجى التحديث للاستمرار في استخدام التطبيق"
 *     responses:
 *       200:
 *         description: App version updated successfully
 *   post:
 *     summary: Create initial app version entry
 *     tags: [App Version]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [version]
 *             properties:
 *               version:
 *                 type: string
 *                 example: "1.0.0"
 *               forceUpdate:
 *                 type: boolean
 *                 example: false
 *               updateMessage:
 *                 type: string
 *                 example: "الإصدار الأول"
 *     responses:
 *       201:
 *         description: App version entry created successfully
 */
router.route("/").get(getAppVersion).put(putAppVersion).post(createAppVersion);

/**
 * @swagger
 * /appVersion/{id}:
 *   put:
 *     summary: Update app version by specific ID
 *     tags: [App Version]
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               version:
 *                 type: string
 *               forceUpdate:
 *                 type: boolean
 *               updateMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: App version updated successfully
 *       404:
 *         description: Version entry not found
 */
router.route("/:id").put(putAppVersion);

module.exports = router;
