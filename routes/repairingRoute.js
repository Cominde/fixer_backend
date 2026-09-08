const express = require("express");
const router = express.Router();

const {
  createRepairing,
  walkInRepair,
  getCarRepairsByNumber,
  updateServiceStateById,
  getAllComRepairs,
  getCarRepairsByid,
  getCarRepairsByGenCode,
  getRepairsReport,
  suggestNextCodeNumber,
  updateRepair,
  deleteRepair,
  searchRepairs,
} = require("../services/repairingService");

const { checkPermission } = require("../middlewares/checkPermission");

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
 *               receptionEngineer:
 *                 type: string
 *                 description: Admin sends "NA"; worker sends their display name
 *                 example: "NA"
 *               representative:
 *                 type: string
 *                 description: Optional sales representative / مندوب
 *                 example: "Ahmed"
 *               delegate:
 *                 type: string
 *                 description: Alias for representative
 *     responses:
 *       201:
 *         description: Repair created successfully
 *       400:
 *         description: Validation error
 */
router.route("/").post(checkPermission("repairs.add"), createRepairing).get(checkPermission("repairs.view"), getAllComRepairs);

/**
 * @swagger
 * /repairing/walkIn:
 *   post:
 *     summary: Create a walk-in repair (without car/user in system)
 *     tags: [Repairing]
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
 *               receptionEngineer:
 *                 type: string
 *                 example: "NA"
 *               representative:
 *                 type: string
 *                 example: "Ahmed"
 *     responses:
 *       201:
 *         description: Walk-in repair created successfully
 *       400:
 *         description: Validation error
 */
router.route("/walkIn").post(checkPermission("repairs.add"), walkInRepair);

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
router.route("/update/:id").put(checkPermission("repairs.edit"), updateRepair);

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
router.route("/gen/:generatedCode").get(checkPermission("repairs.view"), getCarRepairsByGenCode);

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
router.route("/report/:id").get(checkPermission("repairs.view"), getRepairsReport);

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
router.route("/delete/:id").delete(checkPermission("repairs.delete"), deleteRepair);

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
router.route("/:carNumber").get(checkPermission("repairs.view"), getCarRepairsByNumber);

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
router.route("/:serviceId").put(checkPermission("repairs.services.manage"), updateServiceStateById);

/**
 * @swagger
 * /repairing/search/{searchTerm}:
 *   get:
 *     summary: Search repairs by genId, client name, carNumber, or generatedCode
 *     tags: [Repairing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: searchTerm
 *         required: true
 *         schema:
 *           type: string
 *         example: "20211"
 *     responses:
 *       200:
 *         description: Matching repairs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: No repairs found
 */
router.route("/search/:searchTerm").get(checkPermission("repairs.search"), searchRepairs);

module.exports = router;
