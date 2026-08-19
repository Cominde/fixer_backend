const express = require("express");
const router = express.Router();

const {
  createMeasurement,
  walkInMeasurement,
  getAllMeasurements,
  getMeasurementByNumber,
  updateMeasurement,
  deleteMeasurement,
  acceptMeasurement,
} = require("../services/measurementService");

const authService = require("../services/authService");

/**
 * @swagger
 * tags:
 *   name: Measurement
 *   description: Measurement management (estimates pending client approval)
 */

/**
 * @swagger
 * /measurement:
 *   post:
 *     summary: Create a new measurement
 *     tags: [Measurement]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [carNumber]
 *             properties:
 *               carNumber:
 *                 type: string
 *                 example: "أ ن ق - 217"
 *               type:
 *                 type: string
 *                 enum: [periodic, nonPeriodic]
 *                 example: "periodic"
 *               components:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     quantity:
 *                       type: number
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     price:
 *                       type: number
 *                     state:
 *                       type: string
 *               additions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     price:
 *                       type: number
 *               discount:
 *                 type: number
 *                 example: 0
 *               daysItTake:
 *                 type: number
 *                 example: 3
 *               Note1:
 *                 type: string
 *               Note2:
 *                 type: string
 *               distance:
 *                 type: number
 *               nextRepairDistance:
 *                 type: number
 *     responses:
 *       201:
 *         description: Measurement created successfully
 *       400:
 *         description: Validation error
 */
router
  .route("/")
  .post(authService.protect, authService.allowedTo("admin", "mechanic"), createMeasurement)
  .get(authService.protect, authService.allowedTo("admin", "mechanic"), getAllMeasurements);

/**
 * @swagger
 * /measurement/walkIn:
 *   post:
 *     summary: Create walk-in measurement (without car in system)
 *     tags: [Measurement]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientName, carNumber, brand, category, model]
 *             properties:
 *               clientName:
 *                 type: string
 *                 example: "John Doe"
 *               carNumber:
 *                 type: string
 *                 example: "أ ن ق - 217"
 *               brand:
 *                 type: string
 *                 example: "MITSUBISHI"
 *               category:
 *                 type: string
 *                 example: "LANCER PUMA"
 *               model:
 *                 type: string
 *                 example: "2010"
 *               type:
 *                 type: string
 *                 enum: [periodic, nonPeriodic]
 *                 example: "periodic"
 *               components:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     quantity:
 *                       type: number
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     price:
 *                       type: number
 *                     state:
 *                       type: string
 *               additions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     price:
 *                       type: number
 *               discount:
 *                 type: number
 *                 example: 0
 *               daysItTake:
 *                 type: number
 *                 example: 3
 *               Note1:
 *                 type: string
 *               Note2:
 *                 type: string
 *               distance:
 *                 type: number
 *     responses:
 *       201:
 *         description: Walk-in measurement created successfully
 *       400:
 *         description: Validation error
 */
router
  .route("/walkIn")
  .post(authService.protect, authService.allowedTo("admin", "mechanic"), walkInMeasurement);

/**
 * @swagger
 * /measurement/{measurementNumber}:
 *   get:
 *     summary: Get specific measurement by number
 *     tags: [Measurement]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: measurementNumber
 *         required: true
 *         schema:
 *           type: string
 *         example: "MS1"
 *     responses:
 *       200:
 *         description: Measurement retrieved successfully
 *       404:
 *         description: Measurement not found
 */
router
  .route("/:measurementNumber")
  .get(authService.protect, authService.allowedTo("admin"), getMeasurementByNumber);

/**
 * @swagger
 * /measurement/{id}:
 *   put:
 *     summary: Update measurement
 *     tags: [Measurement]
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
 *             properties:
 *               Note1:
 *                 type: string
 *               Note2:
 *                 type: string
 *               discount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Measurement updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Measurement not found
 *   delete:
 *     summary: Delete measurement
 *     tags: [Measurement]
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
 *         description: Measurement deleted successfully
 *       400:
 *         description: Cannot delete converted measurement
 *       404:
 *         description: Measurement not found
 */
router
  .route("/:id")
  .put(authService.protect, authService.allowedTo("admin"), updateMeasurement)
  .delete(authService.protect, authService.allowedTo("admin"), deleteMeasurement);

/**
 * @swagger
 * /measurement/{id}/accept:
 *   put:
 *     summary: Accept or reject measurement
 *     tags: [Measurement]
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
 *             required: [acceptance]
 *             properties:
 *               acceptance:
 *                 type: boolean
 *                 description: true to accept and convert to repair, false to reject
 *                 example: true
 *     responses:
 *       200:
 *         description: Measurement accepted/rejected successfully
 *       400:
 *         description: Validation error or insufficient inventory
 *       404:
 *         description: Measurement not found
 */
router
  .route("/:id/accept")
  .put(authService.protect, authService.allowedTo("admin"), acceptMeasurement);

module.exports = router;
