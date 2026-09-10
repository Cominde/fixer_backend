const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const User = require("../models/userModel");
const { addClient, getClientInfo } = require("../utils/sse/sseService");

/**
 * @desc    SSE endpoint for email verification
 * @route   GET /api/V2/sse/verify?email=<email>
 * @access  Public
 */
export const sseVerify = asyncHandler(async (req, res, next) => {
  const { email } = req.query;

  // Validate email parameter
  if (!email) {
    return next(new ApiError("Email parameter is required", 400));
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new ApiError("Invalid email format", 400));
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if user exists
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return next(new ApiError("User not found", 404));
  }

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control"
  });

  // Handle client disconnect
  req.on("close", () => {
    console.log(`Client disconnected for ${normalizedEmail}`);
  });

  req.on("aborted", () => {
    console.log(`Client aborted connection for ${normalizedEmail}`);
  });

  // Add client to SSE service
  const correlationId = addClient(normalizedEmail, res);

  // Check if user is already verified
  if (user.vertified === true) {
    console.log(`User ${normalizedEmail} already verified, sending immediate verification`);
    
    // Send immediate verification event
    try {
      res.write(`event: verification\n`);
      res.write(`data: ${JSON.stringify({
        type: "verification",
        status: "verified",
        email: normalizedEmail,
        verified: true,
        timestamp: new Date().toISOString(),
        correlationId,
        reason: "already_verified"
      })}\n\n`);
      
      res.end();
      return;
    } catch (error) {
      console.error(`Failed to send immediate verification for ${normalizedEmail}:`, error.message);
      return next(new ApiError("Failed to establish SSE connection", 500));
    }
  }

  // Send initial connection event
  try {
    res.write(`event: verification\n`);
    res.write(`data: ${JSON.stringify({
      type: "verification",
      status: "pending",
      email: normalizedEmail,
      verified: false,
      timestamp: new Date().toISOString(),
      correlationId,
      message: "Waiting for email verification"
    })}\n\n`);
  } catch (error) {
    console.error(`Failed to send initial event for ${normalizedEmail}:`, error.message);
    return next(new ApiError("Failed to establish SSE connection", 500));
  }

  console.log(`SSE verification stream started for ${normalizedEmail} (correlation: ${correlationId})`);
});

/**
 * @desc    Get SSE connection status (for debugging)
 * @route   GET /api/V2/sse/status?email=<email>
 * @access  Public
 */
export const getSseStatus = asyncHandler(async (req, res, next) => {
  const { email } = req.query;

  if (!email) {
    return next(new ApiError("Email parameter is required", 400));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const clientInfo = getClientInfo(normalizedEmail);

  if (clientInfo) {
    res.status(200).json({
      status: "connected",
      email: clientInfo.email,
      correlationId: clientInfo.correlationId,
      connectedAt: clientInfo.createdAt
    });
  } else {
    res.status(200).json({
      status: "not_connected",
      email: normalizedEmail
    });
  }
});
