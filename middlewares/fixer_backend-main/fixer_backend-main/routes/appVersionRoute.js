const express = require("express");
const router = express.Router();

const {
  getAppVersion,
  putAppVersion,
  createAppVersion,
} = require("../services/appVersionService");

router.route("/").get(getAppVersion).put(putAppVersion).post(createAppVersion);
router.route("/:id").put(putAppVersion);

module.exports = router;
