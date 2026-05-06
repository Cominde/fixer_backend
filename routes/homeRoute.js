const express = require("express");
const router = express.Router();

const { getHomepram } = require("../services/homeService");

router.route("/:carNumber").get(getHomepram);

module.exports = router;
