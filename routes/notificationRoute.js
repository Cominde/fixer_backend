const express = require("express");
const router = express.Router();

const {
  saveFCMToken,
  sendNotificationToUser,
  sendNotificationToAllUsers,
} = require("../services/notificationFire");
const authService = require("../services/authService");

/**
 * @swagger
 * /Notification/saveFCMToken/{userId}:
 *   post:
 *     summary: Save FCM token for a specific user
 *     tags: [Notifications]
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
 *         example: "6735c716e41091cfb6b03563"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken]
 *             properties:
 *               fcmToken:
 *                 type: string
 *                 example: "dfTqcbI1b15tX4InglRJkQ:APA91bGTKub0DroKxN6..."
 *     responses:
 *       200:
 *         description: FCM token saved successfully
 *       404:
 *         description: User not found
 */
router
  .route("/saveFCMToken/:userId")
  .post(authService.protect, authService.allowedTo("user"), saveFCMToken);

/**
 * @swagger
 * /Notification/send/{id}:
 *   post:
 *     summary: Send a push notification to a specific user
 *     tags: [Notifications]
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
 *         example: "6735c716e41091cfb6b03563"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "سيارتك جاهزة"
 *               body:
 *                 type: string
 *                 example: "يمكنك استلام سيارتك الآن من الورشة"
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       404:
 *         description: User not found or no FCM token
 */
router
  .route("/send/:id")
  .post(
    authService.protect,
    authService.allowedTo("admin"),
    sendNotificationToUser,
  );

/**
 * @swagger
 * /Notification/notificationSendAll:
 *   post:
 *     summary: Send a push notification to all users
 *     tags: [Notifications]
 *     x-category: system
 *     x-status: "new"
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "عرض خاص"
 *               body:
 *                 type: string
 *                 example: "خصم 20% على جميع خدمات الصيانة هذا الشهر"
 *     responses:
 *       200:
 *         description: Notification sent to all users successfully
 */
router
  .route("/notificationSendAll/")
  .post(
    authService.protect,
    authService.allowedTo("admin"),
    sendNotificationToAllUsers,
  );

module.exports = router;
