const admin = require("../config/fireBase.js");
const User = require("../models/userModel.js");
const Car = require("../models/Car");
const asyncHandler = require("express-async-handler");
const apiError = require("../utils/apiError");
const booking = require("../models/booking.js");

// ─── Helper: find user by car reference ───────────────────────────
const findUserByCarNumber = async (carNumber) => {
  return await User.findOne({ "car.carNumber": carNumber });
};
// @desc save fireBase token for user in the database
// @Route put /api/v1/user/saveFCMToken/:userId
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
  
  // Subscribe user to all_users topic
  try {
    await admin.messaging().subscribeToTopic(fcmToken, "all_users");
  } catch (error) {
    console.log("there is error to join all notification broadcast")
  }
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
};

// ─── 2. Car Needs Check (State = "Need to check") ─────────────────
exports.sendNeedsCheckNotification = async (carNumber) => {
  const user = await findUserByCarNumber(carNumber);
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
};

// @desc send notification to spacific user
// @Route post /api/v2/notification/sned/:userId
// @access private
exports.sendNotificationToUser = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;
  const { title, body } = req.body;

  if (!title || !body) {
    return next(new apiError(`title and body are required`, 400));
  }

  const user = await User.findById(userId);
  if (!user)
    return next(new apiError(`there is no user with this id ${userId}`, 404));

  if (!user.fcmToken) {
    return next(
      new apiError(`there is no FCM token for this user ${userId}`, 404),
    );
  }

  if (!admin.apps.length) {
    return next(new apiError("Firebase not properly initialized", 500));
  }

  try {
    const message = {
      token: user.fcmToken,
      notification: { title, body },
      data: { type: "admin_message" },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    };

    const response = await admin.messaging().send(message);

    res.json({
      success: true,
      message: `Notification sent to ${user.name}`,
      messageId: response,
    });
  } catch (error) {
    const fcmErrors = {
      "messaging/registration-token-not-registered": [
        `User's FCM token is no longer valid.`,
        410,
      ],
      "messaging/invalid-registration-token": [`Invalid FCM token.`, 400],
      "messaging/unavailable": [
        `FCM service temporarily unavailable. Please try again.`,
        503,
      ],
      "messaging/internal-error": [
        `FCM internal error. Please try again.`,
        500,
      ],
    };

    const [message, status] = fcmErrors[error.code] || [
      `Failed to send notification: ${error.message}`,
      500,
    ];

    return next(new apiError(message, status));
  }
});

// @desc send notification to all users
// @Route post /api/v2/notificationSendAll/
// @access private
exports.sendNotificationToAllUsers = asyncHandler(async (req, res, next) => {
  const { title, body } = req.body;
  if (!title || !body)
    return next(new apiError(`title and body are required`, 400));
  
  try {
    await admin.messaging().send({
      topic: "all_users",
      notification: { title, body },
      data: { type: "admin_broadcast" },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });

    res.json({ success: true, message: `Notification sent to all users` });
  } catch (error) {
    return next(new apiError(`Failed to send notification: ${error.message}`, 500));
  }
});

// @desc send notification admin for booking request
// @Route post /api/v2/booking/
// @access private

exports.notifyAdmins = async ({
  user_name,
  carNumber,
  maintenanceRequest,
  title,
  body,
}) => {
  const admins = await User.find({
    role: "admin",
    fcmToken: { $exists: true, $ne: null },
  });

  if (admins.length === 0 || !admin.apps.length) return;

  const tokens = admins.map((a) => a.fcmToken);
  const message = {
    notification: {
      title,
      body,
    },
    data: {
      type: "maintenance_request",
      requestId: maintenanceRequest._id.toString(),
    },
    android: {
      priority: "high",
      notification: {
        tag: maintenanceRequest._id.toString(), // نفس التاج بتاع الإشعار الأصلي عشان يستبدله/يشيله
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          "thread-id": maintenanceRequest._id.toString(), // نفس الفكرة على iOS
        },
      },
    },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    response.responses.forEach((r, idx) => {
      if (
        !r.success &&
        (r.error?.code === "messaging/registration-token-not-registered" ||
          r.error?.code === "messaging/invalid-registration-token")
      ) {
        User.findByIdAndUpdate(admins[idx]._id, {
          $unset: { fcmToken: 1 },
        }).catch(() => {});
      }
    });

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to notify admins",
      error: error.message,
    };
  }
};
