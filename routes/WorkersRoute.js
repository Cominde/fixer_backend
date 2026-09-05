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
  resetSalaryFieldsOnFirstDay,
  deleteWorkerFinancialRecord,
  setWorkerImage,
  setWorkerPassword,
  getWorkerRepairCount,
} = require("../services/WorksServices");

const {
  addWorkerValidator,
} = require("../utils/validator/phoneNumberValidator");

const { checkPermission } = require("../middlewares/checkPermission");
const { uploadSingleImage } = require("../middlewares/uploadImageMiddleware");
const { processWorkerImage } = require("../middlewares/uploadImageCloud");

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

/**
 * @swagger
 * /Worker/reset-salary:
 *   post:
 *     summary: Reset salary fields on first day of month (cron job)
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     description: Resets salaryAfterProcces and salaryAfterReword to base salary for workers whose loans/penalties/rewards are from previous months
 *     responses:
 *       200:
 *         description: Salary fields reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 processedWorkers:
 *                   type: number
 */
router.route("/reset-salary").post(checkPermission("workers.salary.edit"), resetSalaryFieldsOnFirstDay);

/**
 * @swagger
 * /Worker/{id}/{type}/{itemId}:
 *   delete:
 *     summary: Delete a specific loan, penalty, or reward from a worker
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
 *         description: Worker ID
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [loans, penalty, reward]
 *         example: "loans"
 *         description: Type of financial record to delete
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439011"
 *         description: ID of the specific loan/penalty/reward to delete
 *     responses:
 *       200:
 *         description: Financial record deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid type parameter
 *       404:
 *         description: Worker or financial record not found
 */
router.route("/:id/:type/:itemId").delete(checkPermission("workers.money.delete"), deleteWorkerFinancialRecord);

/**
 * @swagger
 * /Worker/{id}/image:
 *   post:
 *     summary: Set profile image for a worker
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
 *         description: Worker image set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       404:
 *         description: Worker not found
 */
router.route("/:id/image").post(
  checkPermission("workers.edit"),
  uploadSingleImage("image"),
  processWorkerImage,
  setWorkerImage
);

/**
 * @swagger
 * /Worker/{id}/password:
 *   post:
 *     summary: Set new password for a worker
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
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password of the worker
 *               newPassword:
 *                 type: string
 *                 description: New password (minimum 6 characters)
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request (missing fields or password too short)
 *       401:
 *         description: Current password is incorrect
 *       404:
 *         description: Worker not found
 */
router.route("/:id/password").post(setWorkerPassword);

/**
 * @swagger
 * /Worker/{id}/repairs/count:
 *   get:
 *     summary: Get number of repairs for a specific worker in date range
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
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (ISO format: YYYY-MM-DD)
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (ISO format: YYYY-MM-DD)
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Repair count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     workerId:
 *                       type: string
 *                     workerName:
 *                       type: string
 *                     repairCount:
 *                       type: number
 *                     startDate:
 *                       type: string
 *                     endDate:
 *                       type: string
 *       400:
 *         description: Missing startDate or endDate parameters
 *       404:
 *         description: Worker not found
 */
router.route("/:id/repairs/count").get(getWorkerRepairCount);

module.exports = router;
