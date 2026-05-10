const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    // Try to use JSON file first (local development)
    const serviceAccount = require("./serviceAccountKey.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("[Firebase] Initialized with serviceAccountKey.json");
  } catch (err) {
    // JSON file not found → use environment variables (Render/production)
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    console.log("[Firebase] Initialized with environment variables");
  }
}

module.exports = admin;
