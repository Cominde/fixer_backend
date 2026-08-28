const express = require("express");
const router = express.Router();

const {
  createBookingRequest,
  getSpacificRequest,
  cancelRequest,
  getallUserRequests,
  getallRequests,
  ReplyofRequest
} = require("../services/BookingService");

const authService = require("../services/authService"); // عدّل المسار حسب مشروعك

/**
 * @swagger
 * tags:
 *   name: booking
 *   description: must be authenticated
 */

router.use(authService.protect);

/**
 * @swagger
 * tags:
 *   name: Booking
 *   description: Maintenance booking requests management
 */

/**
 * @swagger
 * /booking:
 *   post:
 *     summary: Create a new maintenance booking request
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, date, carNumber]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "صيانة فرامل"
 *               description:
 *                 type: string
 *                 example: "صوت غريب عند الفرملة"
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-08-01"
 *               carNumber:
 *                 type: string
 *                 example: "ABC1234"
 *     responses:
 *       201:
 *         description: Maintenance request created and admins notified
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: User or car not found
 */
router.route("/").post(createBookingRequest);

/**
 * @swagger
 * /booking/requests:
 *   get:
 *     summary: Get all booking requests for the logged-in user
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's maintenance requests
 */
router.route("/requests").get(getallUserRequests);
/**
 * @swagger
 * /booking/requests:
 *   get:
 *     summary: Get all booking requests
 *     tags: [Booking]
 *     responses:
 *       200:
 *         description: List of users maintenance requests
 */
router.route("/allrequests").get(getallRequests);

/**
 * @swagger
 * /booking/{id}:
 *   get:
 *     summary: Get a specific booking request by ID
 *     tags: [Booking]
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
 *         description: Booking request details
 *       404:
 *         description: Request not found
 *   put:
 *     summary: Cancel a booking request
 *     tags: [Booking]
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
 *         description: Request cancelled successfully and admins notified
 *       403:
 *         description: Not allowed to cancel this request
 *       404:
 *         description: Request not found
 *       400:
 *         description: Request already cancelled or not in a cancellable state
 */
router.route("/:id").get(getSpacificRequest).put(cancelRequest);
/**
 * @swagger
 * /booking/admin/{id}:
 *   put:
 *     summary: replay a booking request
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "6734de56e41091cfb6b02f7e"
 *       - in: body
 *         name: replay
 *         required: true
 *         schema:
 *           type: string
 *         example: 
 *             acceptedExample:
 *               summary: accepted the request
 *               value: "accepted"
 *             rejectedExample:
 *               summary: rejected the request
 *               value: "rejected"
 *     responses:
 *       200:
 *         description: Request reply successfully 
 *       404:
 *         description: Request not found
 *       400:
 *         description: Request already cancelled 
 */
router.route("/admin/:id").put(ReplyofRequest);

module.exports = router;
