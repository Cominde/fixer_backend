const express = require("express");
const {
  getUserValidator,
  createUserValidator,
  updateUserValidator,
  deleteUserValidator,
  changeUserPasswordValidator,
  updateLoggedUserValidator,
} = require("../utils/validator/userValidator");
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  makeUserUnactive,
  uploadUserImage,
  changeUserPassword,
  searchForUser,
  suggestNextCodeNumber,
  getLoggedUserData,
  updateLoggedUserPassword,
  updateLoggedUserData,
  deleteUser,
} = require("../services/userService");
const { uploadSingleImage } = require("../middlewares/uploadImageMiddleware");
const {
  processUserImage,
  UpdateUserImage,
} = require("../middlewares/uploadImageCloud");

const authService = require("../services/authService");
const { saveFCMToken } = require("../services/notificationFire");
const { checkPermission } = require("../middlewares/checkPermission");
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management (Admin only)
 */

/**
 * @swagger
 * /User/changePassword/{id}:
 *   put:
 *     summary: Change a user's password
 *     tags: [Users]
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
 *             required: [currentPassword, newPassword, newPasswordConfirm]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "oldpassword123"
 *               newPassword:
 *                 type: string
 *                 example: "newpassword123"
 *               newPasswordConfirm:
 *                 type: string
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 */
router.put(
  "/changePassword/:id",
  checkPermission("users.edit"),
  changeUserPasswordValidator,
  changeUserPassword,
);

/**
 * @swagger
 * /User:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 10
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phoneNumber:
 *                         type: string
 *                       role:
 *                         type: string
 *                       active:
 *                         type: boolean
 *                       car:
 *                         type: array
 *                         items:
 *                           type: object
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     x-category: system
 *     x-status: "updated"
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, phoneNumber, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Ahmed Ali"
 *               phoneNumber:
 *                 type: string
 *                 example: "01012345678"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 */
router
  .route("/")
  .get(checkPermission("users.view"), getUsers)
  .post(checkPermission("users.edit"), uploadSingleImage("image"), processUserImage, createUser);

/**
 * @swagger
 * /User/{id}:
 *   get:
 *     summary: Get a specific user by ID
 *     tags: [Users]
 *     x-category: system
 *     x-status: "updated"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "6735c716e41091cfb6b03563"
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 *   put:
 *     summary: Update user details
 *     tags: [Users]
 *     x-category: system
 *     x-status: "updated"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *   delete:
 *     summary: Delete a user by ID
 *     tags: [Users]
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
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router
  .route("/:id")
  .get(checkPermission("users.view"), getUserValidator, getUser)
  .put(
    checkPermission("users.edit"),
    uploadSingleImage("image"),
    UpdateUserImage,
    updateUserValidator,
    updateUser,
  )
  .delete(checkPermission("users.delete"), deleteUserValidator, deleteUser);

/**
 * @swagger
 * /User/saveFCMToken/{userId}:
 *   put:
 *     summary: Save FCM token for push notifications
 *     tags: [Users]
 *     x-category: app
 *     x-new: true
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
 *                 example: "dfTqcbI1b15tX4InglRJkQ:APA91b..."
 *     responses:
 *       200:
 *         description: FCM token saved successfully
 */
router.route("/saveFCMToken/:userId").put(saveFCMToken);

/**
 * @swagger
 * /User/active/{id}:
 *   put:
 *     summary: Toggle user active/inactive status
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "6735c716e41091cfb6b03563"
 *     responses:
 *       200:
 *         description: User status toggled successfully
 *       404:
 *         description: User not found
 */
router.route("/active/:id").put(checkPermission("users.edit"), makeUserUnactive);

/**
 * @swagger
 * /User/search/{searchString}:
 *   get:
 *     summary: Search for users by name or phone number
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: searchString
 *         required: true
 *         schema:
 *           type: string
 *         example: "Ahmed"
 *     responses:
 *       200:
 *         description: Matching users
 */
router.route("/search/:searchString").get(checkPermission("users.view"), searchForUser);

/**
 * @swagger
 * /User/carCode/{clientType}:
 *   get:
 *     summary: Suggest the next car code number for a client type
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientType
 *         required: true
 *         schema:
 *           type: string
 *         example: "regular"
 *     responses:
 *       200:
 *         description: Suggested next car code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: string
 *                   example: "C182"
 */
router.route("/carCode/:clientType").get(checkPermission("users.view"), suggestNextCodeNumber);

export = router;
