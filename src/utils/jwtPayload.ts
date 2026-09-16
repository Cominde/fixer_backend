const jwt = require("jsonwebtoken");

/**
 * Single place to interpret JWT payloads created by createToken().
 *
 * createToken(user._id)            → { userId: "<id>" }
 * createToken({ userId, userType }) → { userId: { userId, userType } }
 *
 * Always returns a string id (or null). Safe for admin + worker tokens.
 * Does not change token format or any FE contract.
 */
export const resolveUserIdFromDecoded = (decoded) => {
  if (!decoded || decoded.userId == null) return null;
  const raw = decoded.userId;
  if (typeof raw === "object") {
    const nested = raw.userId ?? raw._id;
    return nested != null ? String(nested) : null;
  }
  return String(raw);
};

export const getBearerToken = (req) => {
  const header = req.headers?.authorization;
  if (!header || typeof header !== "string") return null;
  if (header.startsWith("Bearer ")) return header.slice(7).trim() || null;
  return header.trim() || null;
};

export const verifyAndResolveUserId = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  return {
    decoded,
    userId: resolveUserIdFromDecoded(decoded),
  };
};
