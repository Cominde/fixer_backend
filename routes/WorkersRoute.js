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
  getAllWorkersWithSalary,
  getWorkerWithSalaryById,
} = require("../services/WorksServices");

const {
  addWorkerValidator,
} = require("../utils/validator/phoneNumberValidator");

const { checkPermission } = require("../middlewares/checkPermission");

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
router.route("/").get(checkPermission("workers.view"), getAllWorkers).post(checkPermission("workers.add"), addWorkerValidator, addWorker);

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
  .delete(checkPermission("workers.delete"), deleteWorker)
  .post(checkPermission("workers.money.add"), moneyFromToworker)
  .get(checkPermission("workers.view"), getSpacificWorker);

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
router.route("/search/:searchString").get(checkPermission("workers.view"), searchForWorker);

/**
 * @swagger
 * /Worker/salary:
 *   get:
 *     summary: Get all workers with salary information
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all workers with salary details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: number
 *                 paginationResult:
 *                   type: object
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       phoneNumber:
 *                         type: string
 *                       jobTitle:
 *                         type: string
 *                       salary:
 *                         type: number
 *                       salaryAfterProcces:
 *                         type: number
 *                       salaryAfterReword:
 *                         type: number
 */
router.route("/salary").get(checkPermission("workers.salary.view"), getAllWorkersWithSalary);

/**
 * @swagger
 * /Worker/salary/{id}:
 *   get:
 *     summary: Get specific worker with salary by ID
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
 *         description: Worker details with salary information
 *       404:
 *         description: Worker not found
 */
router.route("/salary/:id").get(checkPermission("workers.salary.view"), getWorkerWithSalaryById);

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
router.route("/withoutNID/:id").put(checkPermission("workers.edit"), UpdateWorkerDetals);

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
router.route("/:IdNumber").put(checkPermission("workers.edit"), UpdateWorkerDetalsByNID);

module.exports = router;
