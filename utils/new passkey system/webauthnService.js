const crypto = require("crypto");
const cbor = require("cbor");

const base64url = require("base64url");
const Passkey = require("../models/passkeyModel");
const Challenge = require("../models/challengeModel");
const User = require("../models/userModel");
const Worker = require("../models/Worker");
const ApiError = require("../utils/apiError");
const createToken = require("../utils/createToken");
const mongoose = require("mongoose");
const admin = require("../config/fireBase.js");
// WebAuthn configuration
const DEFAULT_RP_ID = process.env.WEBAUTHN_RP_ID || "cominde.org";
const RP_NAME = process.env.WEBAUTHN_RP_NAME || "Fixer";
const ALLOWED_ORIGINS = process.env.WEBAUTHN_ALLOWED_ORIGINS
  ? process.env.WEBAUTHN_ALLOWED_ORIGINS.split(",")
  : [
      "http://localhost:3000",
      "http://localhost:4000",
      "http://localhost:4100",
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://127.0.0.1:*",
      "http://localhost:*",
      "https://fixer-system-site-test.vercel.app",
      "https://fixer-admin.cominde.org",
      "https://fixer.cominde.org",
    ];

/**
 * Get RP_ID based on origin for multi-domain support
 */
const getRpId = (origin) => {
  const url = new URL(origin);
  const hostname = url.hostname;

  // For vercel.app domains, use vercel.app as RP_ID
  if (hostname.endsWith("vercel.app")) {
    return "vercel.app";
  }

  // For cominde.org domains, use cominde.org as RP_ID
  if (hostname.endsWith("cominde.org")) {
    return "cominde.org";
  }

  // For localhost, use localhost
  if (hostname === "localhost" || hostname.startsWith("127.0.0.1")) {
    return "localhost";
  }

  // Default to environment variable or fallback
  return DEFAULT_RP_ID;
};

/**
 * Generate a random challenge
 */
const generateChallenge = () => {
  return base64url.encode(crypto.randomBytes(32));
};

/**
 * Validate origin against allowed origins
 */
const validateOrigin = (origin) => {
  if (!origin) {
    throw new ApiError("Origin is required", 400);
  }

  console.log("Validating origin:", origin);
  console.log("Allowed origins:", ALLOWED_ORIGINS);

  // Allow localhost wildcard and 127.0.0.1 wildcard for development
  const isLocalhost =
    origin.includes("localhost") || origin.includes("127.0.0.1");

  const isValidOrigin = ALLOWED_ORIGINS.some((allowed) => {
    // Exact match for production origins
    if (!isLocalhost && allowed !== "*" && !origin.startsWith(allowed)) {
      return false;
    }
    // Allow any localhost/127.0.0.1 origin in development
    if (
      isLocalhost &&
      (allowed === "http://localhost:*" || allowed === "http://127.0.0.1:*")
    ) {
      return true;
    }
    // Default check for exact match or wildcard
    return origin.startsWith(allowed) || allowed === "*";
  });

  if (!isValidOrigin) {
    console.log("Origin validation failed for:", origin);
    throw new ApiError("Origin not allowed", 403);
  }

  console.log("Origin validation passed for:", origin);
  return true;
};

/**
 * FIX: Proper WebAuthn signature verification
 * Signed data = authData bytes || SHA-256(clientDataJSON bytes)
 */
const verifyWebAuthnSignature = (
  storedPublicKey,
  authenticatorData,
  signature,
  clientDataJSONb64,
) => {
  try {
    // 1. Decode the stored COSE public key
    const publicKeyBuffer = base64url.toBuffer(storedPublicKey);
    const coseKey = cbor.decodeFirstSync(publicKeyBuffer);

    // COSE key map: {1: kty, 3: alg, -1: crv, -2: x, -3: y}
    const x = coseKey.get(-2);
    const y = coseKey.get(-3);

    if (!x || !y) {
      throw new Error("Invalid COSE key: missing x or y coordinates");
    }

    // 2. Reconstruct the EC public key in JWK format
    const publicKey = crypto.createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: x.toString("base64url"),
        y: y.toString("base64url"),
      },
      format: "jwk",
    });

    // 3. Build verification data = authData || SHA256(clientDataJSON raw bytes)
    const authDataBuffer = base64url.toBuffer(authenticatorData);
    const clientDataBuffer = Buffer.from(clientDataJSONb64, "base64"); // raw bytes from browser
    const clientDataHash = crypto
      .createHash("sha256")
      .update(clientDataBuffer)
      .digest();
    const verificationData = Buffer.concat([authDataBuffer, clientDataHash]);

    // 4. Verify ECDSA signature
    const signatureBuffer = base64url.toBuffer(signature);
    return crypto
      .createVerify("SHA256")
      .update(verificationData)
      .verify(publicKey, signatureBuffer);
  } catch (error) {
    console.error("Signature verification error:", error.message);
    return false;
  }
};

/**
 * Create and store challenge
 */
const createChallenge = async (
  type,
  userId = null,
  email = null,
  expiryMinutes = 5,
) => {
  const challenge = generateChallenge();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await Challenge.create({
    challenge,
    type,
    userId,
    email,
    expiresAt,
  });

  return challenge;
};

/**
 * Validate challenge
 */
const validateChallenge = async (
  challenge,
  type,
  userId = null,
  email = null,
) => {
  const challengeDoc = await Challenge.findOne({
    challenge,
    type,
    $or: [{ userId: userId }, { email: email }],
  });

  if (!challengeDoc) {
    throw new ApiError("Challenge not found", 400);
  }

  if (challengeDoc.usedAt) {
    throw new ApiError("Challenge already used", 400);
  }

  if (Date.now() > challengeDoc.expiresAt.getTime()) {
    throw new ApiError("Challenge has expired", 400);
  }

  return challengeDoc;
};

/**
 * Mark challenge as used
 */
const markChallengeUsed = async (challengeId) => {
  await Challenge.findByIdAndUpdate(challengeId, {
    usedAt: new Date(),
  });
};

/**
 * Begin passkey registration
 */
exports.beginPasskeyRegistration = async (userId, origin) => {
  console.log(
    "[PASSKEY REGISTRATION] Starting registration for userId:",
    userId,
  );
  console.log("[PASSKEY REGISTRATION] Origin:", origin);

  validateOrigin(origin);
  const id = userId?._id ?? userId;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log("[PASSKEY REGISTRATION] Invalid user ID format:", id);
    throw new ApiError("Invalid user ID format", 400);
  }
  const user = await User.findById(userId);
  if (!user) {
    console.log("[PASSKEY REGISTRATION] User not found:", userId);
    throw new ApiError("User not found", 404);
  }

  console.log("[PASSKEY REGISTRATION] User found:", user.email);
  const challenge = await createChallenge("register", userId);
  console.log(
    "[PASSKEY REGISTRATION] Generated challenge (base64):",
    challenge,
  );

  const rpId = getRpId(origin);
  console.log("[PASSKEY REGISTRATION] Dynamic RP_ID for origin:", rpId);

  const options = {
    challenge: challenge,
    rp: {
      name: RP_NAME,
      id: rpId,
    },
    user: {
      id: user._id.toString(),
      name: user.email,
      displayName: user.name,
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" }, // ES256
      { alg: -257, type: "public-key" }, // RS256
    ],
    timeout: 60000,
    attestation: "direct",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
    },
  };

  console.log(
    "[PASSKEY REGISTRATION] Returning options:",
    JSON.stringify(options, null, 2),
  );
  return options;
};

/**
 * Finish passkey registration
 */
exports.finishPasskeyRegistration = async (
  userId,
  credential,
  origin,
  clientDataJSON,
) => {
  console.log("[PASSKEY FINISH REGISTRATION] Starting finish registration");
  console.log("[PASSKEY FINISH REGISTRATION] userId:", userId);
  console.log("[PASSKEY FINISH REGISTRATION] origin:", origin);

  validateOrigin(origin);

  const user = await User.findById(userId);
  if (!user) {
    console.log("[PASSKEY FINISH REGISTRATION] User not found:", userId);
    throw new ApiError("User not found", 404);
  }

  console.log("[PASSKEY FINISH REGISTRATION] User found:", user.email);

  // FIX: Decode base64 before parsing
  const clientData = JSON.parse(
    Buffer.from(clientDataJSON, "base64").toString("utf8"),
  );
  const challenge = clientData.challenge;

  console.log(
    "[PASSKEY FINISH REGISTRATION] Client data challenge:",
    challenge,
  );
  console.log(
    "[PASSKEY FINISH REGISTRATION] Client data type:",
    clientData.type,
  );
  console.log(
    "[PASSKEY FINISH REGISTRATION] Client data origin:",
    clientData.origin,
  );

  const challengeDoc = await validateChallenge(challenge, "register", userId);
  console.log("[PASSKEY FINISH REGISTRATION] Challenge validated");

  // Verify client data
  if (clientData.type !== "webauthn.create") {
    console.log(
      "[PASSKEY FINISH REGISTRATION] Invalid client data type:",
      clientData.type,
    );
    throw new ApiError("Invalid client data type", 400);
  }

  if (clientData.origin !== origin) {
    console.log(
      "[PASSKEY FINISH REGISTRATION] Origin mismatch:",
      clientData.origin,
      "vs",
      origin,
    );
    throw new ApiError("Origin mismatch", 400);
  }

  // FIX: Remove incorrect rpId check — clientDataJSON never contains rpId

  // Extract credential data
  const { id, response } = credential;
  console.log("[PASSKEY FINISH REGISTRATION] Credential ID:", id);
  console.log(
    "[PASSKEY FINISH REGISTRATION] Response has attestationObject:",
    !!response.attestationObject,
  );

  // FIX: Extract the actual COSE public key from inside the attestationObject
  // Previously this stored the entire attestationObject which is wrong
  const attestationBuffer = base64url.toBuffer(response.attestationObject);
  const attestation = cbor.decodeFirstSync(attestationBuffer);
  const authData = attestation.authData; // Raw Buffer

  console.log(
    "[PASSKEY FINISH REGISTRATION] Auth data length:",
    authData.length,
  );

  // authData binary layout:
  // [0-31]   rpIdHash          (32 bytes)
  // [32]     flags             (1 byte)
  // [33-36]  signCount         (4 bytes, big-endian)
  // [37-52]  aaguid            (16 bytes)
  // [53-54]  credentialIdLen   (2 bytes, big-endian)
  // [55 + credentialIdLen...]  credentialPublicKey (COSE-encoded)
  const credentialIdLength = authData.readUInt16BE(53);
  const publicKeyBytes = authData.slice(55 + credentialIdLength); // ✅ real COSE public key

  console.log(
    "[PASSKEY FINISH REGISTRATION] Credential ID length:",
    credentialIdLength,
  );
  console.log(
    "[PASSKEY FINISH REGISTRATION] Public key bytes length:",
    publicKeyBytes.length,
  );

  // Read the counter from authData
  const counter = authData.readUInt32BE(33);
  console.log("[PASSKEY FINISH REGISTRATION] Counter:", counter);

  // Store the passkey with the correct public key
  const passkeyData = {
    userId: user._id,
    credentialId: base64url.encode(base64url.toBuffer(id)),
    publicKey: base64url.encode(publicKeyBytes), // ✅ COSE public key only
    counter,
    transports: response.transports || ["internal", "usb", "nfc", "ble"],
    aaguid: "00000000-0000-0000-0000-000000000000",
    label: `${user.name}'s Passkey`,
  };

  console.log(
    "[PASSKEY FINISH REGISTRATION] Creating passkey with data:",
    JSON.stringify(passkeyData, null, 2),
  );

  const newPasskey = await Passkey.create(passkeyData);
  console.log(
    "[PASSKEY FINISH REGISTRATION] Passkey created successfully:",
    newPasskey._id,
  );

  // Mark challenge as used
  await markChallengeUsed(challengeDoc._id);
  console.log("[PASSKEY FINISH REGISTRATION] Challenge marked as used");

  return {
    status: "success",
    message: "Passkey registered successfully",
  };
};

/**
 * Begin passkey login
 */
exports.beginPasskeyLogin = async (email, origin) => {
  validateOrigin(origin);

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    // Don't reveal if user exists for security
    const challenge = await createChallenge("login", null, email);
    const rpId = getRpId(origin);
    return { allowCredentials: [], challenge, rpId };
  }

  const passkeys = await Passkey.find({
    userId: user._id,
    revokedAt: { $exists: false },
  });

  const allowCredentials = passkeys.map((passkey) => ({
    id: passkey.credentialId,
    type: "public-key",
    transports: passkey.transports,
  }));

  const challenge = await createChallenge("login", user._id, email);
  console.log("Generated login challenge (base64):", challenge);

  const rpId = getRpId(origin);
  console.log("[PASSKEY LOGIN] Dynamic RP_ID for origin:", rpId);

  return {
    allowCredentials,
    challenge,
    rpId: rpId,
    userVerification: "required",
  };
};

/**
 * Finish passkey login
 */
exports.finishPasskeyLogin = async (credential, origin, clientDataJSON) => {
  console.log("[PASSKEY FINISH LOGIN] Starting finish login");
  console.log("[PASSKEY FINISH LOGIN] Origin:", origin);

  validateOrigin(origin);

  // Decode base64 clientDataJSON before parsing
  const clientData = JSON.parse(
    Buffer.from(clientDataJSON, "base64").toString("utf8"),
  );
  const challenge = clientData.challenge;

  console.log("[PASSKEY FINISH LOGIN] Client data challenge:", challenge);
  console.log("[PASSKEY FINISH LOGIN] Client data type:", clientData.type);
  console.log("[PASSKEY FINISH LOGIN] Client data origin:", clientData.origin);

  // Find the challenge
  const challengeDoc = await Challenge.findOne({
    challenge,
    type: "login",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!challengeDoc) {
    console.log("[PASSKEY FINISH LOGIN] Challenge not found or expired");
    throw new ApiError("Invalid or expired challenge", 400);
  }

  console.log("[PASSKEY FINISH LOGIN] Challenge validated");

  // Verify client data fields
  if (clientData.type !== "webauthn.get") {
    console.log(
      "[PASSKEY FINISH LOGIN] Invalid client data type:",
      clientData.type,
    );
    throw new ApiError("Invalid client data type", 400);
  }

  if (clientData.origin !== origin) {
    console.log(
      "[PASSKEY FINISH LOGIN] Origin mismatch:",
      clientData.origin,
      "vs",
      origin,
    );
    throw new ApiError("Origin mismatch", 400);
  }

  // Extract credential fields
  const { id, response } = credential;
  const { authenticatorData, signature } = response;

  console.log("[PASSKEY FINISH LOGIN] Credential ID:", id);
  console.log(
    "[PASSKEY FINISH LOGIN] Has authenticatorData:",
    !!authenticatorData,
  );
  console.log("[PASSKEY FINISH LOGIN] Has signature:", !!signature);

  // Find the stored passkey
  const passkey = await Passkey.findOne({
    credentialId: base64url.encode(base64url.toBuffer(id)),
    revokedAt: { $exists: false },
  });

  if (!passkey) {
    console.log(
      "[PASSKEY FINISH LOGIN] Passkey not found for credential ID:",
      id,
    );
    throw new ApiError("Passkey not found", 400);
  }

  console.log("[PASSKEY FINISH LOGIN] Passkey found, user ID:", passkey.userId);

  // FIX: Use proper WebAuthn signature verification
  // Signed data = authenticatorData bytes || SHA256(clientDataJSON raw bytes)
  const isValidSignature = verifyWebAuthnSignature(
    passkey.publicKey,
    authenticatorData,
    signature,
    clientDataJSON, // raw base64 string — hashed internally
  );

  if (!isValidSignature) {
    console.log("[PASSKEY FINISH LOGIN] Signature verification failed");
    throw new ApiError("Signature verification failed", 400);
  }

  console.log("[PASSKEY FINISH LOGIN] Signature verified successfully");

  // Check counter to prevent replay attacks
  const currentCounter = base64url.toBuffer(authenticatorData).readUInt32BE(33);
  console.log(
    "[PASSKEY FINISH LOGIN] Current counter:",
    currentCounter,
    "Stored counter:",
    passkey.counter,
  );

  if (currentCounter < passkey.counter) {
    console.log("[PASSKEY FINISH LOGIN] Counter replay attack detected");
    throw new ApiError("Counter replay attack detected", 400);
  }

  // Get user
  const user = await User.findById(challengeDoc.userId || passkey.userId);
  if (!user) {
    console.log("[PASSKEY FINISH LOGIN] User not found");
    throw new ApiError("User not found", 404);
  }

  console.log("[PASSKEY FINISH LOGIN] User found:", user.email);

  // Update passkey usage stats
  await Passkey.findByIdAndUpdate(passkey._id, {
    counter: currentCounter,
    lastUsedAt: new Date(),
  });

  // Mark challenge as used
  await markChallengeUsed(challengeDoc._id);

  // Generate JWT
  const authToken = createToken({ userId: user._id });

  // Subscribe admin to notifications if they have FCM token
  if (user.fcmToken && user.role === "admin") {
    await admin
      .messaging()
      .subscribeToTopic(user.fcmToken, "admin_notifications");
    console.log(
      `[FCM] Admin ${user.email} subscribed to admin_notifications via passkey`,
    );
  }

  const userResponse = { ...user._doc };
  delete userResponse.password;
  delete userResponse.vertified;

  console.log("[PASSKEY FINISH LOGIN] Login successful for user:", user.email);

  return {
    status: "success",
    message: "Login successful",
    token: authToken,
    data: {
      user: userResponse,
    },
  };
};

/**
 * List user passkeys
 */
exports.listUserPasskeys = async (userId) => {
  const passkeys = await Passkey.find({
    userId,
    revokedAt: { $exists: false },
  }).select("-publicKey");

  return passkeys;
};

/**
 * Revoke passkey
 */
exports.revokePasskey = async (userId, credentialId) => {
  const result = await Passkey.updateOne(
    {
      userId,
      credentialId,
      revokedAt: { $exists: false },
    },
    {
      revokedAt: new Date(),
    },
  );

  if (result.matchedCount === 0) {
    throw new ApiError("Passkey not found or already revoked", 404);
  }

  return {
    status: "success",
    message: "Passkey revoked successfully",
  };
};

/**
 * Begin passkey registration for worker
 */
exports.beginWorkerPasskeyRegistration = async (workerId, origin) => {
  console.log(
    "[WORKER PASSKEY REGISTRATION] Starting registration for workerId:",
    workerId,
  );
  console.log("[WORKER PASSKEY REGISTRATION] Origin:", origin);

  validateOrigin(origin);
  const id = workerId?._id ?? workerId;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log("[WORKER PASSKEY REGISTRATION] Invalid worker ID format:", id);
    throw new ApiError("Invalid worker ID format", 400);
  }
  const worker = await Worker.findById(workerId);
  if (!worker) {
    console.log("[WORKER PASSKEY REGISTRATION] Worker not found:", workerId);
    throw new ApiError("Worker not found", 404);
  }

  console.log("[WORKER PASSKEY REGISTRATION] Worker found:", worker.name);
  const challenge = await createChallenge("worker-register", workerId);
  console.log(
    "[WORKER PASSKEY REGISTRATION] Generated challenge (base64):",
    challenge,
  );

  const rpId = getRpId(origin);
  console.log("[WORKER PASSKEY REGISTRATION] Dynamic RP_ID for origin:", rpId);

  const options = {
    challenge: challenge,
    rp: {
      name: RP_NAME,
      id: rpId,
    },
    user: {
      id: worker._id.toString(),
      name: worker.phoneNumber,
      displayName: worker.name,
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" }, // ES256
      { alg: -257, type: "public-key" }, // RS256
    ],
    timeout: 60000,
    attestation: "direct",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
    },
  };

  console.log(
    "[WORKER PASSKEY REGISTRATION] Returning options:",
    JSON.stringify(options, null, 2),
  );
  return options;
};

/**
 * Finish passkey registration for worker
 */
exports.finishWorkerPasskeyRegistration = async (
  workerId,
  credential,
  origin,
  clientDataJSON,
) => {
  console.log("[WORKER PASSKEY FINISH REGISTRATION] Starting finish registration");
  console.log("[WORKER PASSKEY FINISH REGISTRATION] workerId:", workerId);
  console.log("[WORKER PASSKEY FINISH REGISTRATION] origin:", origin);

  validateOrigin(origin);

  const worker = await Worker.findById(workerId);
  if (!worker) {
    console.log("[WORKER PASSKEY FINISH REGISTRATION] Worker not found:", workerId);
    throw new ApiError("Worker not found", 404);
  }

  console.log("[WORKER PASSKEY FINISH REGISTRATION] Worker found:", worker.name);

  const clientData = JSON.parse(
    Buffer.from(clientDataJSON, "base64").toString("utf8"),
  );
  const challenge = clientData.challenge;

  console.log(
    "[WORKER PASSKEY FINISH REGISTRATION] Client data challenge:",
    challenge,
  );
  console.log(
    "[WORKER PASSKEY FINISH REGISTRATION] Client data type:",
    clientData.type,
  );
  console.log(
    "[WORKER PASSKEY FINISH REGISTRATION] Client data origin:",
    clientData.origin,
  );

  const challengeDoc = await validateChallenge(challenge, "worker-register", workerId);
  console.log("[WORKER PASSKEY FINISH REGISTRATION] Challenge validated");

  if (clientData.type !== "webauthn.create") {
    console.log(
      "[WORKER PASSKEY FINISH REGISTRATION] Invalid client data type:",
      clientData.type,
    );
    throw new ApiError("Invalid client data type", 400);
  }

  if (clientData.origin !== origin) {
    console.log(
      "[WORKER PASSKEY FINISH REGISTRATION] Origin mismatch:",
      clientData.origin,
      "vs",
      origin,
    );
    throw new ApiError("Origin mismatch", 400);
  }

  const { id, response } = credential;
  console.log("[WORKER PASSKEY FINISH REGISTRATION] Credential ID:", id);
  console.log(
    "[WORKER PASSKEY FINISH REGISTRATION] Response has attestationObject:",
    !!response.attestationObject,
  );

  const attestationBuffer = base64url.toBuffer(response.attestationObject);
  const attestation = cbor.decodeFirstSync(attestationBuffer);
  const authData = attestation.authData;

  console.log(
    "[WORKER PASSKEY FINISH REGISTRATION] Auth data length:",
    authData.length,
  );

  const credentialIdLength = authData.readUInt16BE(53);
  const publicKeyBytes = authData.slice(55 + credentialIdLength);

  console.log(
    "[WORKER PASSKEY FINISH REGISTRATION] Credential ID length:",
    credentialIdLength,
  );
  console.log(
    "[WORKER PASSKEY FINISH REGISTRATION] Public key bytes length:",
    publicKeyBytes.length,
  );

  const counter = authData.readUInt32BE(33);
  console.log("[WORKER PASSKEY FINISH REGISTRATION] Counter:", counter);

  const passkeyData = {
    userId: worker._id,
    credentialId: base64url.encode(base64url.toBuffer(id)),
    publicKey: base64url.encode(publicKeyBytes),
    counter,
    transports: response.transports || ["internal", "usb", "nfc", "ble"],
    aaguid: "00000000-0000-0000-0000-000000000000",
    label: `${worker.name}'s Passkey`,
    userType: "worker",
  };

  console.log(
    "[WORKER PASSKEY FINISH REGISTRATION] Creating passkey with data:",
    JSON.stringify(passkeyData, null, 2),
  );

  const newPasskey = await Passkey.create(passkeyData);
  console.log(
    "[WORKER PASSKEY FINISH REGISTRATION] Passkey created successfully:",
    newPasskey._id,
  );

  await markChallengeUsed(challengeDoc._id);
  console.log("[WORKER PASSKEY FINISH REGISTRATION] Challenge marked as used");

  return {
    status: "success",
    message: "Worker passkey registered successfully",
  };
};

/**
 * Begin passkey login for worker
 */
exports.beginWorkerPasskeyLogin = async (phoneNumber, origin) => {
  validateOrigin(origin);

  const worker = await Worker.findOne({ phoneNumber: phoneNumber.trim() });
  if (!worker) {
    const challenge = await createChallenge("worker-login", null, phoneNumber);
    const rpId = getRpId(origin);
    return { allowCredentials: [], challenge, rpId };
  }

  const passkeys = await Passkey.find({
    userId: worker._id,
    revokedAt: { $exists: false },
    userType: "worker",
  });

  const allowCredentials = passkeys.map((passkey) => ({
    id: passkey.credentialId,
    type: "public-key",
    transports: passkey.transports,
  }));

  const challenge = await createChallenge("worker-login", worker._id, phoneNumber);
  console.log("Generated worker login challenge (base64):", challenge);

  const rpId = getRpId(origin);
  console.log("[WORKER PASSKEY LOGIN] Dynamic RP_ID for origin:", rpId);

  return {
    allowCredentials,
    challenge,
    rpId: rpId,
    userVerification: "required",
  };
};

/**
 * Finish passkey login for worker
 */
exports.finishWorkerPasskeyLogin = async (credential, origin, clientDataJSON) => {
  console.log("[WORKER PASSKEY FINISH LOGIN] Starting finish login");
  console.log("[WORKER PASSKEY FINISH LOGIN] Origin:", origin);

  validateOrigin(origin);

  const clientData = JSON.parse(
    Buffer.from(clientDataJSON, "base64").toString("utf8"),
  );
  const challenge = clientData.challenge;

  console.log("[WORKER PASSKEY FINISH LOGIN] Client data challenge:", challenge);
  console.log("[WORKER PASSKEY FINISH LOGIN] Client data type:", clientData.type);
  console.log("[WORKER PASSKEY FINISH LOGIN] Client data origin:", clientData.origin);

  const challengeDoc = await Challenge.findOne({
    challenge,
    type: "worker-login",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!challengeDoc) {
    console.log("[WORKER PASSKEY FINISH LOGIN] Challenge not found or expired");
    throw new ApiError("Invalid or expired challenge", 400);
  }

  console.log("[WORKER PASSKEY FINISH LOGIN] Challenge validated");

  if (clientData.type !== "webauthn.get") {
    console.log(
      "[WORKER PASSKEY FINISH LOGIN] Invalid client data type:",
      clientData.type,
    );
    throw new ApiError("Invalid client data type", 400);
  }

  if (clientData.origin !== origin) {
    console.log(
      "[WORKER PASSKEY FINISH LOGIN] Origin mismatch:",
      clientData.origin,
      "vs",
      origin,
    );
    throw new ApiError("Origin mismatch", 400);
  }

  const { id, response } = credential;
  const { authenticatorData, signature } = response;

  console.log("[WORKER PASSKEY FINISH LOGIN] Credential ID:", id);
  console.log(
    "[WORKER PASSKEY FINISH LOGIN] Has authenticatorData:",
    !!authenticatorData,
  );
  console.log("[WORKER PASSKEY FINISH LOGIN] Has signature:", !!signature);

  const passkey = await Passkey.findOne({
    credentialId: base64url.encode(base64url.toBuffer(id)),
    revokedAt: { $exists: false },
    userType: "worker",
  });

  if (!passkey) {
    console.log(
      "[WORKER PASSKEY FINISH LOGIN] Passkey not found for credential ID:",
      id,
    );
    throw new ApiError("Passkey not found", 400);
  }

  console.log("[WORKER PASSKEY FINISH LOGIN] Passkey found, worker ID:", passkey.userId);

  const isValidSignature = verifyWebAuthnSignature(
    passkey.publicKey,
    authenticatorData,
    signature,
    clientDataJSON,
  );

  if (!isValidSignature) {
    console.log("[WORKER PASSKEY FINISH LOGIN] Signature verification failed");
    throw new ApiError("Signature verification failed", 400);
  }

  console.log("[WORKER PASSKEY FINISH LOGIN] Signature verified successfully");

  const currentCounter = base64url.toBuffer(authenticatorData).readUInt32BE(33);
  console.log(
    "[WORKER PASSKEY FINISH LOGIN] Current counter:",
    currentCounter,
    "Stored counter:",
    passkey.counter,
  );

  if (currentCounter < passkey.counter) {
    console.log("[WORKER PASSKEY FINISH LOGIN] Counter replay attack detected");
    throw new ApiError("Counter replay attack detected", 400);
  }

  const worker = await Worker.findById(challengeDoc.userId || passkey.userId);
  if (!worker) {
    console.log("[WORKER PASSKEY FINISH LOGIN] Worker not found");
    throw new ApiError("Worker not found", 404);
  }

  console.log("[WORKER PASSKEY FINISH LOGIN] Worker found:", worker.name);

  await Passkey.findByIdAndUpdate(passkey._id, {
    counter: currentCounter,
    lastUsedAt: new Date(),
  });

  await markChallengeUsed(challengeDoc._id);

  const authToken = createToken({ userId: worker._id, userType: "worker" });

  const workerResponse = { ...worker._doc };
  delete workerResponse.generatedPassword;

  console.log("[WORKER PASSKEY FINISH LOGIN] Login successful for worker:", worker.name);

  return {
    status: "success",
    message: "Login successful",
    token: authToken,
    data: {
      worker: workerResponse,
    },
  };
};
