const express = require("express");
const router = express.Router();
const { uploadSingleImage } = require("../middlewares/uploadImageMiddleware");
const { changeCarColor } = require("../services/change_Color");

router.route("/changeColor").post(uploadSingleImage("image"), changeCarColor);

module.exports = router;
