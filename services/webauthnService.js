const crypto = require("crypto");
const cbor = require("cbor");

const base64url = require("base64url");
const Passkey = require("../models/passkeyModel");
const Challenge = require("../models/challengeModel");
const User = require("../models/userModel");
const ApiError = require("../utils/apiError");
const createToken = require("../utils/createToken");
const mongoose = require("mongoose");
const admin = require("../config/fireBase.js");
// WebAuthn configuration
const RP_ID = process.env.WEBAUTHN_RP_ID || "cominde.org";
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

  // Check for exact match or wildcard
  const isValidOrigin = ALLOWED_ORIGINS.some((allowed) => {
    if (allowed === "*") return true;
    
    // Handle wildcards for localhost
    if (allowed.includes("*")) {
      const pattern = allowed.replace("*", ".*");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }
    
    // Exact match or starts with allowed origin (for subdirectories)
    return origin === allowed || origin.startsWith(allowed);
  });

  if (!isValidOrigin) {
    console.log("Origin validation failed for:", origin);
    console.log("Environment WEBAUTHN_ALLOWED_ORIGINS:", process.env.WEBAUTHN_ALLOWED_ORIGINS);
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
  validateOrigin(origin);
  const id = userId?._id ?? userId;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("Invalid user ID format", 400);
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError("User not found", 404);
  }

  const challenge = await createChallenge("register", userId);
  console.log("Generated challenge (base64):", challenge);

  const options = {
    challenge: challenge,
    rp: {
      name: RP_NAME,
      id: RP_ID,
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
exports.finishPasskeyRegistration = async (
  userId,
  credential,
  origin,
  clientDataJSON,
) => {
  validateOrigin(origin);

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // FIX: Decode base64 before parsing
  const clientData = JSON.parse(
    Buffer.from(clientDataJSON, "base64").toString("utf8"),
  );
  const challenge = clientData.challenge;

  const challengeDoc = await validateChallenge(challenge, "register", userId);

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
  await Passkey.create({
    userId: user._id,
    credentialId: base64url.encode(base64url.toBuffer(id)),
    publicKey: base64url.encode(publicKeyBytes), // ✅ COSE public key only
    counter,
    transports: response.transports || ["internal", "usb", "nfc", "ble"],
    aaguid: "00000000-0000-0000-0000-000000000000",
    label: `${user.name}'s Passkey`,
  });

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
exports.beginPasskeyLogin = async (email, origin) => {
  validateOrigin(origin);

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    // Don't reveal if user exists for security
    const challenge = await createChallenge("login", null, email);
    return { allowCredentials: [], challenge };
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

  return {
    allowCredentials,
    challenge,
    rpId: RP_ID,
    userVerification: "required",
  };
};

/**
 * Finish passkey login
 */
exports.finishPasskeyLogin = async (credential, origin, clientDataJSON) => {
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

  // Find the stored passkey
  const passkey = await Passkey.findOne({
    credentialId: base64url.encode(base64url.toBuffer(id)),
    revokedAt: { $exists: false },
  });

  if (!passkey) {
    throw new ApiError("Passkey not found", 400);
  }

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
  const user = await User.findById(challengeDoc.userId || passkey.userId);
  if (!user) {
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
