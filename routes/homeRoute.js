const express = require("express");
const router = express.Router();

const { getHomepram, cahngeUserPhoto } = require("../services/homeService");
const { uploadSingleImage } = require("../middlewares/uploadImageMiddleware");
const { UpdateUserImage } = require("../middlewares/uploadImageCloud");

/**
 * @swagger
 * tags:
 *   name: Home
 *   description: Home screen data and user profile photo
 */

/**
 * @swagger
 * /Home/{carNumber}:
 *   get:
 *     summary: Get home screen data for a specific car
 *     tags: [Home]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: carNumber
 *         required: true
 *         schema:
 *           type: string
 *         example: "أ ن ق - 217"
 *     responses:
 *       200:
 *         description: Home screen data for this car
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     car:
 *                       type: object
 *                       properties:
 *                         carNumber:
 *                           type: string
 *                         brand:
 *                           type: string
 *                         category:
 *                           type: string
 *                         repairing:
 *                           type: boolean
 *                         nextRepairDate:
 *                           type: string
 *                           format: date-time
 *                         lastRepairDate:
 *                           type: string
 *                           format: date-time
 *                         distances:
 *                           type: number
 *                     owner:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         image:
 *                           type: string
 *       404:
 *         description: Car not found
 */
router.route("/:carNumber").get(getHomepram);

/**
 * @swagger
 * /Home/changeImage/{id}:
 *   put:
 *     summary: Change user profile photo
 *     tags: [Home]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *         example: "6735c716e41091cfb6b03563"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile photo updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     image:
 *                       type: string
 *                       example: "https://res.cloudinary.com/..."
 *       404:
 *         description: User not found
 */
router
  .route("/changeImage/:id")
  .put(uploadSingleImage("image"), UpdateUserImage, cahngeUserPhoto);

module.exports = router;
