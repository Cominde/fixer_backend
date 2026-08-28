const express = require("express");
const router = express.Router();

const {
  createReport,
  getAllReports,
  put_the_bills_rent,
  addorSubthing,
  getmonthWork,
  deleteReport,
} = require("../services/moneyReportServices");
const authService = require("../services/authService");
/**
 * @swagger
 * tags:
 *   name: Monthly Report
 *   description: Monthly financial reports management
 */
/**
 * @swagger
 * tags:
 *   name: Monthly Report
 *   description: Monthly financial reports management (Admin only)
 */

router.use(authService.protect);

// Admin only routes
router.use(authService.allowedTo("admin"));
/**
 * @swagger
 * /MonthlyReport:
 *   get:
 *     summary: Get all monthly reports
 *     tags: [Monthly Report]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all monthly reports
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
 *                       year_month:
 *                         type: string
 *                         example: "2025-01"
 *                       totalIncome:
 *                         type: number
 *                         example: 25000
 *                       totalExpenses:
 *                         type: number
 *                         example: 8000
 *                       rent:
 *                         type: number
 *                         example: 5000
 *                       bills:
 *                         type: number
 *                         example: 2000
 *   post:
 *     summary: Create a new monthly report
 *     tags: [Monthly Report]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [year_month]
 *             properties:
 *               year_month:
 *                 type: string
 *                 example: "2025-01"
 *     responses:
 *       201:
 *         description: Monthly report created successfully
 *       400:
 *         description: Report already exists for this month
 */
router.route("/").get(getAllReports).post(createReport);

/**
 * @swagger
 * /MonthlyReport/put_bills_rent/{year_month}:
 *   put:
 *     summary: Add bills and rent costs to a monthly report
 *     tags: [Monthly Report]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year_month
 *         required: true
 *         schema:
 *           type: string
 *         example: "2025-01"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bills:
 *                 type: number
 *                 example: 2000
 *               rent:
 *                 type: number
 *                 example: 5000
 *     responses:
 *       200:
 *         description: Bills and rent updated successfully
 *       404:
 *         description: Report not found for this month
 */
router.route("/put_bills_rent/:year_month").put(put_the_bills_rent);

/**
 * @swagger
 * /MonthlyReport/addthing:
 *   post:
 *     summary: Add or subtract a custom item from a monthly report
 *     tags: [Monthly Report]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date(year_month_day), title, price]
 *             properties:
 *               date(year_month_day):
 *                 type: string
 *                 example: "2025-01-15"
 *               title:
 *                 type: string
 *                 example: "مصاريف كهرباء"
 *               price:
 *                 type: number
 *                 example: 300 (if subtract make it negative)
 *
 *     responses:
 *       200:
 *         description: Item added/subtracted successfully
 *       404:
 *         description: Report not found
 */
router.route("/addthing/").post(addorSubthing);

/**
 * @swagger
 * /MonthlyReport/home/work/{year_month}:
 *   get:
 *     summary: Get work summary for a specific month (for home screen)
 *     tags: [Monthly Report]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year_month
 *         required: true
 *         schema:
 *           type: string
 *         example: "2025-01"
 *     responses:
 *       200:
 *         description: Monthly work summary data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalIncome:
 *                       type: number
 *                     totalRepairs:
 *                       type: number
 *                     netProfit:
 *                       type: number
 *       404:
 *         description: Report not found for this month
 */
router.route("/home/work/:year_month").get(getmonthWork);

/**
 * @swagger
 * /MonthlyReport/delete/{year_month}:
 *   delete:
 *     summary: Delete a monthly report
 *     tags: [Monthly Report]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year_month
 *         required: true
 *         schema:
 *           type: string
 *         example: "2025-01"
 *     responses:
 *       200:
 *         description: Report deleted successfully
 *       404:
 *         description: Report not found
 */
router.route("/delete/:year_month").delete(deleteReport);

module.exports = router;
