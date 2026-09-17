const crypto = require("crypto");
const cbor = require("cbor");

const base64url = require("base64url");
const Passkey = require("../models/passkeyModel");
const Challenge = require("../models/challengeModel");
const {
  REGISTER,
  LOGIN,
  WORKER_REGISTER_TYPES,
  WORKER_LOGIN_TYPES,
} = require("../models/challengeTypes");
const User = require("../models/userModel");
const Worker = require("../models/Worker");
const ApiError = require("../utils/apiError");
const createToken = require("../utils/createToken");
const mongoose = require("mongoose");
const admin = require("../config/fireBase.js");
// WebAuthn configuration
const DEFAULT_RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
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
    throw new ApiError("Origin not allowed", 403);
  }
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
  const types = Array.isArray(type) ? type : [type];
  const challengeDoc = await Challenge.findOne({
    challenge,
    type: { $in: types },
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
 * The assertion must be signed by a passkey that belongs to the same
 * account the login challenge was issued for. A missing challenge userId
 * (unknown email/phone) must also fail — otherwise a discoverable
 * credential from another account can complete that challenge.
 */
const assertPasskeyBoundToChallenge = (challengeDoc, passkey) => {
  if (!challengeDoc?.userId || !passkey?.userId) {
    throw new ApiError("Passkey does not match this account", 400);
  }
  if (String(challengeDoc.userId) !== String(passkey.userId)) {
    throw new ApiError("Passkey does not match this account", 400);
  }
};

const unknownLoginOptions = async (type, identifier, origin) => {
  const challenge = await createChallenge(type, null, identifier);
  return { allowCredentials: [], challenge, rpId: getRpId(origin) };
};

/**
 * Begin passkey registration
 */
export const beginPasskeyRegistration = async (userId, origin) => {
  validateOrigin(origin);
  const resolvedUserId = userId?._id ?? userId?.userId ?? userId;

  if (!mongoose.Types.ObjectId.isValid(resolvedUserId)) {
    throw new ApiError("Invalid user ID format", 400);
  }
  const user = await User.findById(resolvedUserId);
  if (!user) {
    throw new ApiError("User not found", 404);
  }
  // SECURITY: only admin accounts may register passkeys on the admin
  // endpoints. Customers are User documents too and hold valid JWTs.
  if (user.role !== "admin") {
    throw new ApiError("Passkeys are only available for admin accounts", 403);
  }

  const challenge = await createChallenge("register", resolvedUserId);

  const rpId = getRpId(origin);

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

  return options;
};

/**
 * Finish passkey registration
 */
export const finishPasskeyRegistration = async (
  userId,
  credential,
  origin,
  clientDataJSON,
) => {
  validateOrigin(origin);

  const resolvedUserId = userId?._id ?? userId?.userId ?? userId;
  const user = await User.findById(resolvedUserId);
  if (!user) {
    throw new ApiError("User not found", 404);
  }
  if (user.role !== "admin") {
    throw new ApiError("Passkeys are only available for admin accounts", 403);
  }

  // FIX: Decode base64 before parsing
  const clientData = JSON.parse(
    Buffer.from(clientDataJSON, "base64").toString("utf8"),
  );
  const challenge = clientData.challenge;

  const challengeDoc = await validateChallenge(challenge, "register", resolvedUserId);

  // Verify client data
  if (clientData.type !== "webauthn.create") {
    throw new ApiError("Invalid client data type", 400);
  }

  if (clientData.origin !== origin) {
    throw new ApiError("Origin mismatch", 400);
  }

  // FIX: Remove incorrect rpId check — clientDataJSON never contains rpId

  // Extract credential data
  const { id, response } = credential;

  // FIX: Extract the actual COSE public key from inside the attestationObject
  // Previously this stored the entire attestationObject which is wrong
  const attestationBuffer = base64url.toBuffer(response.attestationObject);
  const attestation = cbor.decodeFirstSync(attestationBuffer);
  const authData = attestation.authData; // Raw Buffer

  // authData binary layout:
  // [0-31]   rpIdHash          (32 bytes)
  // [32]     flags             (1 byte)
  // [33-36]  signCount         (4 bytes, big-endian)
  // [37-52]  aaguid            (16 bytes)
  // [53-54]  credentialIdLen   (2 bytes, big-endian)
  // [55 + credentialIdLen...]  credentialPublicKey (COSE-encoded)
  const credentialIdLength = authData.readUInt16BE(53);
  const publicKeyBytes = authData.slice(55 + credentialIdLength); // ✅ real COSE public key

  // Read the counter from authData
  const counter = authData.readUInt32BE(33);

  // Store the passkey with the correct public key
  const passkeyData = {
    userId: user._id,
    credentialId: base64url.encode(base64url.toBuffer(id)),
    publicKey: base64url.encode(publicKeyBytes), // ✅ COSE public key only
    counter,
    transports: response.transports || ["internal", "usb", "nfc", "ble"],
    aaguid: "00000000-0000-0000-0000-000000000000",
    label: `${user.name}'s Passkey`,
    userType: "admin",
  };

  const newPasskey = await Passkey.create(passkeyData);

  // Mark challenge as used
  await markChallengeUsed(challengeDoc._id);

  return {
    status: "success",
    message: "Passkey registered successfully",
  };
};

/**
 * Begin passkey login
 */
export const beginPasskeyLogin = async (email, origin) => {
  validateOrigin(origin);

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  // Same empty response for unknown emails AND non-admin users so we
  // neither leak whether an account exists nor let a customer JWT/passkey
  // reach the admin app.
  if (!user || user.role !== "admin") {
    return unknownLoginOptions("login", email, origin);
  }

  const passkeys = await Passkey.find({
    userId: user._id,
    revokedAt: { $exists: false },
    userType: { $ne: "worker" },
  });

  const allowCredentials = passkeys.map((passkey) => ({
    id: passkey.credentialId,
    type: "public-key",
    transports: passkey.transports,
  }));

  const challenge = await createChallenge("login", user._id, email);

  const rpId = getRpId(origin);

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
export const finishPasskeyLogin = async (credential, origin, clientDataJSON) => {
  validateOrigin(origin);

  // Decode base64 clientDataJSON before parsing
  const clientData = JSON.parse(
    Buffer.from(clientDataJSON, "base64").toString("utf8"),
  );
  const challenge = clientData.challenge;

  // Find the challenge
  const challengeDoc = await Challenge.findOne({
    challenge,
    type: "login",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!challengeDoc) {
    throw new ApiError("Invalid or expired challenge", 400);
  }

  // Verify client data fields
  if (clientData.type !== "webauthn.get") {
    throw new ApiError("Invalid client data type", 400);
  }

  if (clientData.origin !== origin) {
    throw new ApiError("Origin mismatch", 400);
  }

  // Extract credential fields
  const { id, response } = credential;
  const { authenticatorData, signature } = response;

  // Find the stored passkey (admin passkeys only — worker passkeys
  // must go through the worker login endpoints)
  const passkey = await Passkey.findOne({
    credentialId: base64url.encode(base64url.toBuffer(id)),
    revokedAt: { $exists: false },
    userType: { $ne: "worker" },
  });

  if (!passkey) {
    throw new ApiError("Passkey not found", 400);
  }

  assertPasskeyBoundToChallenge(challengeDoc, passkey);

  // FIX: Use proper WebAuthn signature verification
  // Signed data = authenticatorData bytes || SHA256(clientDataJSON raw bytes)
  const isValidSignature = verifyWebAuthnSignature(
    passkey.publicKey,
    authenticatorData,
    signature,
    clientDataJSON, // raw base64 string — hashed internally
  );

  if (!isValidSignature) {
    throw new ApiError("Signature verification failed", 400);
  }

  // Check counter to prevent replay attacks
  const currentCounter = base64url.toBuffer(authenticatorData).readUInt32BE(33);

  if (currentCounter < passkey.counter) {
    throw new ApiError("Counter replay attack detected", 400);
  }

  // Get user
  const user = await User.findById(passkey.userId);
  if (!user || user.role !== "admin") {
    throw new ApiError("User not found", 404);
  }

  // Update passkey usage stats
  await Passkey.findByIdAndUpdate(passkey._id, {
    counter: currentCounter,
    lastUsedAt: new Date(),
  });

  // Mark challenge as used
  await markChallengeUsed(challengeDoc._id);

  // Generate JWT
  const authToken = createToken(user._id);

  // Subscribe admin to notifications if they have FCM token
  if (user.fcmToken && user.role === "admin") {
    await admin
      .messaging()
      .subscribeToTopic(user.fcmToken, "admin_notifications");
  }

  const userResponse = { ...user._doc };
  delete userResponse.password;
  delete userResponse.vertified;

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
export const listUserPasskeys = async (userId, userType = "admin") => {
  const filter: Record<string, unknown> = {
    userId,
    revokedAt: { $exists: false },
    userType: userType === "worker" ? "worker" : { $ne: "worker" },
  };
  return Passkey.find(filter).select("-publicKey");
};

/**
 * Revoke passkey
 */
export const revokePasskey = async (userId, credentialId) => {
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
export const beginWorkerPasskeyRegistration = async (workerId, origin) => {
  validateOrigin(origin);
  const id = workerId?._id ?? workerId?.userId ?? workerId;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("Invalid worker ID format", 400);
  }
  const worker = await Worker.findById(id);
  if (!worker) {
    throw new ApiError("Worker not found", 404);
  }

  // Use shared `register` (not `worker-register`) so Challenge.create works
  // even when the live schema enum is still only ["register","login"].
  const challenge = await createChallenge(REGISTER, id);
  const rpId = getRpId(origin);

  return {
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
};

/**
 * Finish passkey registration for worker
 */
export const finishWorkerPasskeyRegistration = async (
  workerId,
  credential,
  origin,
  clientDataJSON,
) => {
  validateOrigin(origin);

  const id = workerId?._id ?? workerId?.userId ?? workerId;
  const worker = await Worker.findById(id);
  if (!worker) {
    throw new ApiError("Worker not found", 404);
  }

  const clientData = JSON.parse(
    Buffer.from(clientDataJSON, "base64").toString("utf8"),
  );
  const challenge = clientData.challenge;

  const challengeDoc = await validateChallenge(
    challenge,
    WORKER_REGISTER_TYPES,
    id,
  );

  if (clientData.type !== "webauthn.create") {
    throw new ApiError("Invalid client data type", 400);
  }

  if (clientData.origin !== origin) {
    throw new ApiError("Origin mismatch", 400);
  }

  const { id: credentialIdRaw, response } = credential;

  const attestationBuffer = base64url.toBuffer(response.attestationObject);
  const attestation = cbor.decodeFirstSync(attestationBuffer);
  const authData = attestation.authData;

  const credentialIdLength = authData.readUInt16BE(53);
  const publicKeyBytes = authData.slice(55 + credentialIdLength);
  const counter = authData.readUInt32BE(33);

  await Passkey.create({
    userId: worker._id,
    credentialId: base64url.encode(base64url.toBuffer(credentialIdRaw)),
    publicKey: base64url.encode(publicKeyBytes),
    counter,
    transports: response.transports || ["internal", "usb", "nfc", "ble"],
    aaguid: "00000000-0000-0000-0000-000000000000",
    label: `${worker.name}'s Passkey`,
    userType: "worker",
  });

  await markChallengeUsed(challengeDoc._id);

  return {
    status: "success",
    message: "Worker passkey registered successfully",
  };
};

/**
 * Begin passkey login for worker
 */
export const beginWorkerPasskeyLogin = async (phoneNumber, origin) => {
  validateOrigin(origin);

  const worker = await Worker.findOne({ phoneNumber: phoneNumber.trim() });
  if (!worker) {
    return unknownLoginOptions(LOGIN, phoneNumber, origin);
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

  const challenge = await createChallenge(LOGIN, worker._id, phoneNumber);
  const rpId = getRpId(origin);

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
export const finishWorkerPasskeyLogin = async (credential, origin, clientDataJSON) => {
  validateOrigin(origin);

  const clientData = JSON.parse(
    Buffer.from(clientDataJSON, "base64").toString("utf8"),
  );
  const challenge = clientData.challenge;

  const challengeDoc = await Challenge.findOne({
    challenge,
    type: { $in: WORKER_LOGIN_TYPES },
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!challengeDoc) {
    throw new ApiError("Invalid or expired challenge", 400);
  }

  if (clientData.type !== "webauthn.get") {
    throw new ApiError("Invalid client data type", 400);
  }

  if (clientData.origin !== origin) {
    throw new ApiError("Origin mismatch", 400);
  }

  const { id, response } = credential;
  const { authenticatorData, signature } = response;

  const passkey = await Passkey.findOne({
    credentialId: base64url.encode(base64url.toBuffer(id)),
    revokedAt: { $exists: false },
    userType: "worker",
  });

  if (!passkey) {
    throw new ApiError("Passkey not found", 400);
  }

  assertPasskeyBoundToChallenge(challengeDoc, passkey);

  const isValidSignature = verifyWebAuthnSignature(
    passkey.publicKey,
    authenticatorData,
    signature,
    clientDataJSON,
  );

  if (!isValidSignature) {
    throw new ApiError("Signature verification failed", 400);
  }

  const currentCounter = base64url.toBuffer(authenticatorData).readUInt32BE(33);

  if (currentCounter < passkey.counter) {
    throw new ApiError("Counter replay attack detected", 400);
  }

  const worker = await Worker.findById(passkey.userId);
  if (!worker) {
    throw new ApiError("Worker not found", 404);
  }

  await Passkey.findByIdAndUpdate(passkey._id, {
    counter: currentCounter,
    lastUsedAt: new Date(),
  });

  await markChallengeUsed(challengeDoc._id);

  // Same token shape as POST /auth/worker/login so permissions and
  // checkPermission resolve the worker id the same way.
  const authToken = createToken(worker._id);

  const workerResponse = { ...worker._doc };
  delete workerResponse.generatedPassword;

  return {
    status: "success",
    message: "Login successful",
    token: authToken,
    data: {
      worker: workerResponse,
    },
  };
};
