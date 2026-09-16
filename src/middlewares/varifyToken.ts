const {
  getBearerToken,
  verifyAndResolveUserId,
} = require("../utils/jwtPayload");

/**
 * Lightweight JWT gate for passkey register/list/revoke.
 * Sets req.user = { _id } using the same id resolution as protect / checkPermission.
 * Controllers may still re-read the token; this must never invent a nested .userId.userId miss.
 */
export const verifyToken = (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  try {
    const { userId } = verifyAndResolveUserId(token);
    if (!userId) {
      return res.status(401).json({ message: "Invalid token." });
    }
    req.user = { _id: userId };
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token expired. Please log in again." });
    }
    return res.status(401).json({ message: "Invalid token." });
  }
};
