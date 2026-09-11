const express = require("express");
const router = express.Router();

const {
  getMonthlyOverview
} = require("../controllers/analyticsController");

const authService = require("../services/authService");

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Manager analytics and dashboard endpoints
 */

/**
 * @swagger
 * /analytics/monthly-overview:
 *   get:
 *     summary: Get comprehensive monthly analytics overview
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Custom start date (ISO format: YYYY-MM-DD). When provided with 'to', overrides month/year/day parameters.
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Custom end date (ISO format: YYYY-MM-DD). Must be used with 'from' parameter.
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month (1-12). Defaults to current month. Not used if 'from' and 'to' are provided.
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *         description: 4-digit year. Defaults to current year. Not used if 'from' and 'to' are provided.
 *       - in: query
 *         name: day
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 31
 *         description: Optional day (1-31) for daily filtering. When provided, KPIs and breakdowns are scoped to that day, but dailyTrend still covers the full month. Not used if 'from' and 'to' are provided.
 *     responses:
 *       200:
 *         description: Monthly analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: object
 *                       properties:
 *                         customRange:
 *                           type: boolean
 *                           description: true if using custom from/to range, false if using month/year/day
 *                         year:
 *                           type: integer
 *                           description: Only present when customRange is false
 *                         month:
 *                           type: integer
 *                           description: Only present when customRange is false
 *                         day:
 *                           type: integer
 *                           nullable: true
 *                           description: Only present when customRange is false
 *                         from:
 *                           type: string
 *                           format: date
 *                           description: Only present when customRange is true
 *                         to:
 *                           type: string
 *                           format: date
 *                           description: Only present when customRange is true
 *                         range:
 *                           type: object
 *                           properties:
 *                             from:
 *                               type: string
 *                               format: date-time
 *                             to:
 *                               type: string
 *                               format: date-time
 *                     kpiSummary:
 *                       type: object
 *                       properties:
 *                         totalRepairs:
 *                           type: integer
 *                         totalRevenue:
 *                           type: number
 *                         vsLastMonth:
 *                           type: object
 *                           description: Named "vsLastMonth" for monthly views, "vsPreviousPeriod" for custom date ranges
 *                           properties:
 *                             repairsChange:
 *                               type: string
 *                             revenueChange:
 *                               type: string
 *                         currentlyRepairing:
 *                           type: integer
 *                         averageRepairCost:
 *                           type: number
 *                         averageCompletionTimeHours:
 *                           type: string
 *                         overdueRepairs:
 *                           type: integer
 *                     charts:
 *                       type: object
 *                       properties:
 *                         dailyTrend:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               day:
 *                                 type: integer
 *                               repairCount:
 *                                 type: integer
 *                               completedCount:
 *                                 type: integer
 *                               revenue:
 *                                 type: number
 *                         statusBreakdown:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *                               percentage:
 *                                 type: string
 *                         clientDistribution:
 *                           type: object
 *                           properties:
 *                             walkInCount:
 *                               type: integer
 *                             registeredCount:
 *                               type: integer
 *                             walkInRevenue:
 *                               type: number
 *                             registeredRevenue:
 *                               type: number
 *                         workerProductivity:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               workerId:
 *                                 type: string
 *                               workerName:
 *                                 type: string
 *                               completedRepairs:
 *                                 type: integer
 *                         periodicVsNonPeriodic:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               type:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *                         brandDistribution:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               brand:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *       401:
 *         description: Unauthorized - JWT token missing or invalid
 *       403:
 *         description: Forbidden - User does not have admin or manager role
 *       400:
 *         description: Bad request - Invalid query parameters
 */

// Apply authentication middleware to all routes
router.use(authService.protect);

// Apply role-based access control - only admin and manager can access analytics
router.use(authService.allowedTo("admin", "manager"));

// Analytics routes
router.route("/monthly-overview").get(getMonthlyOverview);

export = router;