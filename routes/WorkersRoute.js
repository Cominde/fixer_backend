const express = require("express");
const router = express.Router();

const {
  UpdateWorkerDetals,
  addWorker,
  getAllWorkers,
  searchForWorker,
  UpdateWorkerDetalsByNID,
  deleteWorker,
  moneyFromToworker,
  getSpacificWorker,
} = require("../services/WorksServices");

const {
  addWorkerValidator,
} = require("../utils/validator/phoneNumberValidator");

/**
 * @swagger
 * tags:
 *   name: Workers
 *   description: Workshop workers management
 */

/**
 * @swagger
 * /Worker:
 *   get:
 *     summary: Get all workers
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all workers
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
 *                         example: "Mohamed Hassan"
 *                       phoneNumber:
 *                         type: string
 *                         example: "01012345678"
 *                       NID:
 *                         type: string
 *                         example: "29901011234567"
 *   post:
 *     summary: Add a new worker
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phoneNumber]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Mohamed Hassan"
 *               phoneNumber:
 *                 type: string
 *                 example: "01012345678"
 *               NID:
 *                 type: string
 *                 example: "29901011234567"
 *     responses:
 *       201:
 *         description: Worker added successfully
 *       400:
 *         description: Validation error - invalid phone number
 */
router.route("/").get(getAllWorkers).post(addWorkerValidator, addWorker);

/**
 * @swagger
 * /Worker/{id}:
 *   get:
 *     summary: Get a specific worker by ID
 *     tags: [Workers]
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
 *         description: Worker details
 *       404:
 *         description: Worker not found
 *   post:
 *     summary: Add or subtract money from/to a worker
 *     tags: [Workers]
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
 *             required: [amount, type]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 500
 *               type:
 *                 type: string
 *                 enum: [add, subtract]
 *                 example: "add"
 *               note:
 *                 type: string
 *                 example: "مكافأة شهر يناير"
 *     responses:
 *       200:
 *         description: Money transaction recorded successfully
 *       404:
 *         description: Worker not found
 *   delete:
 *     summary: Delete a worker by ID
 *     tags: [Workers]
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
 *         description: Worker deleted successfully
 *       404:
 *         description: Worker not found
 */
router
  .route("/:id")
  .delete(deleteWorker)
  .post(moneyFromToworker)
  .get(getSpacificWorker);

/**
 * @swagger
 * /Worker/search/{searchString}:
 *   get:
 *     summary: Search workers by name or phone
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: searchString
 *         required: true
 *         schema:
 *           type: string
 *         example: "Mohamed"
 *     responses:
 *       200:
 *         description: Matching workers
 */
router.route("/search/:searchString").get(searchForWorker);

/**
 * @swagger
 * /Worker/withoutNID/{id}:
 *   put:
 *     summary: Update worker details by ID (without NID)
 *     tags: [Workers]
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
 *               name:
 *                 type: string
 *                 example: "Mohamed Hassan"
 *               phoneNumber:
 *                 type: string
 *                 example: "01012345678"
 *     responses:
 *       200:
 *         description: Worker updated successfully
 *       404:
 *         description: Worker not found
 */
router.route("/withoutNID/:id").put(UpdateWorkerDetals);

/**
 * @swagger
 * /Worker/{IdNumber}:
 *   put:
 *     summary: Update worker details by National ID number
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: IdNumber
 *         required: true
 *         description: Worker's National ID number
 *         schema:
 *           type: string
 *         example: "29901011234567"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Worker updated by NID successfully
 *       404:
 *         description: Worker not found
 */
router.route("/:IdNumber").put(UpdateWorkerDetalsByNID);

module.exports = router;
