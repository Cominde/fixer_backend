const crypto = require("crypto");

// Map to store active SSE connections by email
const clients = new Map(); // email -> { res, heartbeatInterval, timeoutId, correlationId }

/**
 * Generate a unique correlation ID for tracking SSE sessions
 */
const generateCorrelationId = () => {
  return crypto.randomUUID();
};

/**
 * Add a new SSE client connection
 * @param {string} email - User email (normalized)
 * @param {Response} res - Express response object
 * @param {number} timeoutMs - Connection timeout in milliseconds
 * @returns {string} correlationId
 */
const addClient = (email, res, timeoutMs = 5 * 60 * 1000) => {
  // Normalize email for consistent key
  const normalizedEmail = email.toLowerCase().trim();

  // Remove existing client if any
  removeClient(normalizedEmail);

  const correlationId = generateCorrelationId();

  // Set up heartbeat interval
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`event: ping\n`);
      res.write(
        `data: ${JSON.stringify({
          type: "ping",
          ts: new Date().toISOString(),
          correlationId,
        })}\n\n`,
      );
    } catch (error) {
      console.error(`Heartbeat failed for ${normalizedEmail}:`, error.message);
      removeClient(normalizedEmail);
    }
  }, 20000); // 20 seconds

  // Set up timeout
  const timeoutId = setTimeout(() => {
    try {
      res.write(`event: verification\n`);
      res.write(
        `data: ${JSON.stringify({
          type: "verification",
          status: "timeout",
          email: normalizedEmail,
          verified: false,
          reason: "not_verified_within_window",
          timestamp: new Date().toISOString(),
          correlationId,
        })}\n\n`,
      );
    } catch (error) {
      console.error(
        `Timeout event failed for ${normalizedEmail}:`,
        error.message,
      );
    }
    res.end();
    removeClient(normalizedEmail);
  }, timeoutMs);

  clients.set(normalizedEmail, {
    res,
    heartbeatInterval,
    timeoutId,
    correlationId,
    createdAt: new Date(),
  });

  console.log(
    `SSE client connected: ${normalizedEmail} (correlation: ${correlationId})`,
  );
  return correlationId;
};

/**
 * Remove an SSE client connection
 * @param {string} email - User email
 */
const removeClient = (email) => {
  const normalizedEmail = email.toLowerCase().trim();
  const client = clients.get(normalizedEmail);

  if (client) {
    // Clear heartbeat and timeout
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }
    if (client.timeoutId) {
      clearTimeout(client.timeoutId);
    }

    clients.delete(normalizedEmail);
    console.log(
      `SSE client disconnected: ${normalizedEmail} (correlation: ${client.correlationId})`,
    );
  }
};

/**
 * Notify a specific client with verification status
 * @param {string} email - User email
 * @param {Object} data - Data to send
 */
const notifyClient = (email, data) => {
  const normalizedEmail = email.toLowerCase().trim();
  const client = clients.get(normalizedEmail);

  if (client) {
    try {
      const eventData = {
        type: "verification",
        status: data.status || "unknown",
        email: normalizedEmail,
        verified: data.status === "verified",
        timestamp: new Date().toISOString(),
        correlationId: client.correlationId,
        ...data,
      };

      client.res.write(`event: verification\n`);
      client.res.write(`data: ${JSON.stringify(eventData)}\n\n`);

      // If verification is complete, close the connection
      if (data.status === "verified") {
        console.log(
          `Verification sent to ${normalizedEmail}, closing connection`,
        );
        client.res.end();
        removeClient(normalizedEmail);
      }
    } catch (error) {
      console.error(
        `Failed to notify client ${normalizedEmail}:`,
        error.message,
      );
      removeClient(normalizedEmail);
    }
  }
};

/**
 * Get client information for debugging
 * @param {string} email - User email
 * @returns {Object|null} Client info
 */
const getClientInfo = (email) => {
  const normalizedEmail = email.toLowerCase().trim();
  const client = clients.get(normalizedEmail);

  if (client) {
    return {
      email: normalizedEmail,
      correlationId: client.correlationId,
      createdAt: client.createdAt,
    };
  }

  return null;
};

/**
 * Get all active connections (for monitoring)
 * @returns {Array} Array of active client info
 */
const getAllClients = () => {
  return Array.from(clients.entries()).map(([email, client]) => ({
    email,
    correlationId: client.correlationId,
    createdAt: client.createdAt,
  }));
};

export = {
  addClient,
  removeClient,
  notifyClient,
  getClientInfo,
  getAllClients,
};
