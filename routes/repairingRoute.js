const express = require("express");
const router = express.Router();

const {
  createRepairing,
  getCarRepairsByNumber,
  updateServiceStateById,
  getAllComRepairs,
  getCarRepairsByid,
  getCarRepairsByGenCode,
  getRepairsReport,
  suggestNextCodeNumber,
  updateRepair,
  deleteRepair,
} = require("../services/repairingService");

/**
 * @swagger
 * tags:
 *   name: Repairing
 *   description: Car repair services management
 */

/**
 * @swagger
 * /repairing:
 *   get:
 *     summary: Get all repair records
 *     tags: [Repairing]
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
 *         description: List of all repairs
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
 *                       carNumber:
 *                         type: string
 *                         example: "أ ن ق - 217"
 *                       type:
 *                         type: string
 *                         example: "nonPeriodic"
 *                       totalPrice:
 *                         type: number
 *                         example: 3250
 *                       discount:
 *                         type: number
 *                         example: 250
 *                       complete:
 *                         type: boolean
 *                         example: false
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *   post:
 *     summary: Create a new repair record
 *     tags: [Repairing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [carNumber, type]
 *             properties:
 *               carNumber:
 *                 type: string
 *                 example: "أ ن ق - 217"
 *               genId:
 *                 type: string
 *                 example: "20211159"
 *               type:
 *                 type: string
 *                 enum: [nonPeriodic, Periodic]
 *                 example: "nonPeriodic"
 *               totalPrice:
 *                 type: number
 *                 example: 3250
 *               discount:
 *                 type: number
 *                 example: 250
 *               brand:
 *                 type: string
 *                 example: "MITSUBISHI"
 *               category:
 *                 type: string
 *                 example: "LANCER PUMA"
 *               model:
 *                 type: string
 *                 example: "2010"
 *               Services:
 *                 type: array
 *                 items:
 *                   type: object
 *               additions:
 *                 type: array
 *                 items:
 *                   type: object
 *               Note1:
 *                 type: string
 *                 example: "تبديل زيت - طنابير أمامي"
 *               Note2:
 *                 type: string
 *                 example: "NEXT SERVICE: ..."
 *     responses:
 *       201:
 *         description: Repair created successfully
 *       400:
 *         description: Validation error
 */
router.route("/").post(createRepairing).get(getAllComRepairs);

/**
 * @swagger
 * /repairing/nextCode/suggestNextCodeNumber:
 *   get:
 *     summary: Suggest the next repair code number
 *     tags: [Repairing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Next suggested repair code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: string
 *                   example: "R-2025-001"
 */
router.route("/nextCode/suggestNextCodeNumber").get(suggestNextCodeNumber);

/**
 * @swagger
 * /repairing/getById/{id}:
 *   get:
 *     summary: Get a specific repair record by ID
 *     tags: [Repairing]
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
 *         description: Repair record details
 *       404:
 *         description: Repair not found
 */
router.route("/getById/:id").get(getCarRepairsByid);

/**
 * @swagger
 * /repairing/update/{id}:
 *   put:
 *     summary: Update a repair record by ID
 *     tags: [Repairing]
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
 *               totalPrice:
 *                 type: number
 *                 example: 3500
 *               discount:
 *                 type: number
 *                 example: 300
 *               Note1:
 *                 type: string
 *               Note2:
 *                 type: string
 *               complete:
 *                 type: boolean
 *                 example: true
 *               Services:
 *                 type: array
 *                 items:
 *                   type: object
 *               additions:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Repair updated successfully
 *       404:
 *         description: Repair not found
 */
router.route("/update/:id").put(updateRepair);

/**
 * @swagger
 * /repairing/gen/{generatedCode}:
 *   get:
 *     summary: Get all repairs for a car by its generated code
 *     tags: [Repairing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: generatedCode
 *         required: true
 *         schema:
 *           type: string
 *         example: "C181"
 *     responses:
 *       200:
 *         description: Repairs for this generated code
 *       404:
 *         description: No repairs found
 */
router.route("/gen/:generatedCode").get(getCarRepairsByGenCode);

/**
 * @swagger
 * /repairing/report/{id}:
 *   get:
 *     summary: Get full repair report by repair ID
 *     tags: [Repairing]
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
 *         description: Full repair report data
 *       404:
 *         description: Repair not found
 */
router.route("/report/:id").get(getRepairsReport);

/**
 * @swagger
 * /repairing/delete/{id}:
 *   delete:
 *     summary: Delete a repair record by ID
 *     tags: [Repairing]
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
 *         description: Repair deleted successfully
 *       404:
 *         description: Repair not found
 */
router.route("/delete/:id").delete(deleteRepair);

/**
 * @swagger
 * /repairing/{carNumber}:
 *   get:
 *     summary: Get all repairs for a car by its plate number
 *     tags: [Repairing]
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
 *         description: List of repairs for this car number
 *       404:
 *         description: No repairs found for this car number
 */
router.route("/:carNumber").get(getCarRepairsByNumber);

/**
 * @swagger
 * /repairing/{serviceId}:
 *   put:
 *     summary: Update the state of a specific service inside a repair
 *     tags: [Repairing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
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
 *             required: [state]
 *             properties:
 *               state:
 *                 type: string
 *                 example: "done"
 *     responses:
 *       200:
 *         description: Service state updated successfully
 *       404:
 *         description: Service not found
 */
router.route("/:serviceId").put(updateServiceStateById);

module.exports = router;
