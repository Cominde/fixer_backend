const admin = require("../config/fireBase.js");
const User = require("../models/userModel.js");
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
  console.log(userId);
  console.log(user);
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
  if (!title || !body)
    return next(new apiError(`title and body are required`, 400));
  const user = await User.findById(userId);
  if (!user)
    return next(new apiError(`there is no user with this id ${userId}`, 404));
  if (!user.fcmToken)
    return next(
      new apiError(`there is fcd token for this user ${userId}`, 404),
    );

  await admin.messaging().send({
    token: user.fcmToken,
    notification: { title, body },
    data: { type: "admin_message" },
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  });

  console.log(`[FCM] Admin notification sent to user: ${userId}`);
  res.json({ success: true, message: `Notification sent to ${user.name}` });
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

  console.log("[FCM] Broadcast sent via topic: all_users");
  res.json({ success: true, message: `Notification sent to all users` });
});
