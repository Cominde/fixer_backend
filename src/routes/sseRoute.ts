const express = require("express");
const { sseVerify, getSseStatus } = require("../services/sseVerifyService");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: SSE
 *   description: Server-Sent Events for real-time verification
 */

/**
 * @swagger
 * /SSE/verify:
 *   get:
 *     summary: Open SSE stream for email verification
 *     tags: [SSE]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: User email to monitor for verification
 *     responses:
 *       200:
 *         description: SSE stream established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid email parameter
 *       404:
 *         description: User not found
 */
router.get("/verify", sseVerify);

/**
 * @swagger
 * /SSE/status:
 *   get:
 *     summary: Check SSE connection status for debugging
 *     tags: [SSE]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: User email to check connection status
 *     responses:
 *       200:
 *         description: Connection status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [connected, not_connected]
 *                 email:
 *                   type: string
 *                 correlationId:
 *                   type: string
 *                 connectedAt:
 *                   type: string
 *                   format: date-time
 */
router.get("/status", getSseStatus);

export = router;
