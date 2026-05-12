const admin = require("../config/fireBase.js");
const User = require("../models/userModel.js");
const Car = require("../models/Car");
const asyncHandler = require("express-async-handler");
const apiError = require("../utils/apiError");

// ─── Helper: find user by car reference ───────────────────────────
const findUserByCarNumber = async (carNumber) => {
  return await User.findOne({ "car.carNumber": carNumber });
};
// @desc save fireBase token for user in the database
// @Route put /api/v2/user/saveFCMToken/:userId
// @access public
exports.saveFCMToken = asyncHandler(async (req, res, next) => {
  const userId = req.params.userId;
  const { fcmToken } = req.body;
  const user = await User.findById(userId);
  if (!fcmToken) return next(new apiError(`user token are required`, 400));
  if (!user)
    return next(new apiError(`there is no user with this id ${userId}`, 404));
  if (user.fcmToken && user.fcmToken !== fcmToken) {
    await admin.messaging().unsubscribeFromTopic(user.fcmToken, "all_users");
  }
  user.fcmToken = fcmToken;
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, message: `FCM token saved successfully` });
});

// ─── 1. Repair Done (State = "Good") ──────────────────────────────
exports.sendRepairDoneNotification = async (carNumber) => {
  const user = await findUserByCarNumber(carNumber);
  if (!user?.fcmToken) return;

  await admin.messaging().send({
    token: user.fcmToken,
    notification: {
      title: "✅ Repair Completed",
      body: `Your car with number ${carNumber} repair is done. It's ready for pickup!`,
    },
    data: { type: "repair_done", carNumber: String(carNumber) },
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  });

  console.log(`[FCM] Repair done notification sent to user: ${user._id}`);
};

// ─── 2. Car Needs Check (State = "Need to check") ─────────────────
exports.sendNeedsCheckNotification = async (carNumber) => {
  const user = await findUserByCarNumber(carNumber);
  console.log(user);
  if (!user?.fcmToken) return;

  await admin.messaging().send({
    token: user.fcmToken,
    notification: {
      title: "⚠️ Car Needs Inspection",
      body: `Your car with number ${carNumber} is due for a check-up. Please schedule a visit.`,
    },
    data: { type: "needs_check", carNumber: String(carNumber) },
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  });

  console.log(`[FCM] Needs check notification sent to user: ${user._id}`);
};

// @desc send notification to spacific user
// @Route post /api/v2/notification/sned/:userId
// @access private
exports.sendNotificationToUser = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;
  const { title, body } = req.body;

  console.log(
    `[FCM DEBUG] Request received - userId: ${userId}, title: ${title}, body: ${body}`,
  );

  if (!title || !body)
    return next(new apiError(`title and body are required`, 400));

  const user = await User.findById(userId);
  console.log(`[FCM DEBUG] User found: ${user ? "YES" : "NO"}`);
  if (user) {
    console.log(`[FCM DEBUG] User details:`, {
      id: user._id,
      name: user.name,
      email: user.email,
      fcmToken: user.fcmToken ? "EXISTS" : "MISSING",
      tokenLength: user.fcmToken ? user.fcmToken.length : 0,
    });
  }

  if (!user)
    return next(new apiError(`there is no user with this id ${userId}`, 404));

  if (!user.fcmToken) {
    console.log(`[FCM DEBUG] FCM token missing for user: ${userId}`);
    return next(
      new apiError(`there is no FCM token for this user ${userId}`, 404),
    );
  }

  // Test Firebase admin initialization
  try {
    const apps = admin.apps;
    console.log(`[FCM DEBUG] Firebase apps initialized: ${apps.length}`);
    if (apps.length === 0) {
      console.error("[FCM DEBUG] Firebase not initialized!");
      return next(new apiError("Firebase not properly initialized", 500));
    }
  } catch (initError) {
    console.error(
      "[FCM DEBUG] Firebase initialization check failed:",
      initError,
    );
  }

  try {
    console.log(`[FCM DEBUG] Preparing message for user: ${userId}`);
    console.log(`[FCM DEBUG] FCM Token: ${user.fcmToken.substring(0, 20)}...`);

    const message = {
      token: user.fcmToken,
      notification: { title, body },
      data: { type: "admin_message" },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    };

    console.log(
      `[FCM DEBUG] Message prepared:`,
      JSON.stringify(message, null, 2),
    );
    console.log(`[FCM DEBUG] Sending to Firebase...`);

    const response = await admin.messaging().send(message);
    console.log(`[FCM SUCCESS] Notification sent successfully!`);
    console.log(`[FCM SUCCESS] User: ${userId}, MessageId: ${response}`);

    res.json({
      success: true,
      message: `Notification sent to ${user.name || userId}`,
      messageId: response,
    });
  } catch (error) {
    console.error(`[FCM ERROR] Failed to send notification to user: ${userId}`);
    console.error(`[FCM ERROR] Error code: ${error.code}`);
    console.error(`[FCM ERROR] Error message: ${error.message}`);
    console.error(`[FCM ERROR] Full error:`, error);

    // Handle specific FCM errors
    if (error.code === "messaging/registration-token-not-registered") {
      console.log(
        `[FCM ERROR] Token no longer registered, removing from database`,
      );
      user.fcmToken = undefined;
      await user.save({ validateBeforeSave: false });
      return next(
        new apiError(
          `User's FCM token is no longer valid. Token has been removed.`,
          410,
        ),
      );
    } else if (error.code === "messaging/invalid-registration-token") {
      console.log(`[FCM ERROR] Invalid token format, removing from database`);
      user.fcmToken = undefined;
      await user.save({ validateBeforeSave: false });
      return next(
        new apiError(`Invalid FCM token. Token has been removed.`, 400),
      );
    } else if (error.code === "messaging/unavailable") {
      console.log(`[FCM ERROR] FCM service unavailable`);
      return next(
        new apiError(
          `FCM service temporarily unavailable. Please try again.`,
          503,
        ),
      );
    } else if (error.code === "messaging/internal-error") {
      console.log(`[FCM ERROR] Internal FCM error`);
      return next(new apiError(`FCM internal error. Please try again.`, 500));
    } else {
      console.log(`[FCM ERROR] Unknown error occurred`);
      return next(
        new apiError(`Failed to send notification: ${error.message}`, 500),
      );
    }
  }
});

// @desc send notification to all users
// @Route post /api/v2/notificationSendAll/
// @access private
exports.sendNotificationToAllUsers = asyncHandler(async (req, res, next) => {
  const { title, body } = req.body;
  if (!title || !body)
    return next(new apiError(`title and body are required`, 400));
  await admin.messaging().send({
    topic: "all_users",
    notification: { title, body },
    data: { type: "admin_broadcast" },
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  });

  res.json({ success: true, message: `Notification sent to all users` });
});
