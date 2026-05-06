const slugify = require("slugify");
const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleWare");
const Worker = require("../../models/Worker");

exports.addWorkerValidator = [
  check("name")
    .notEmpty()
    .withMessage("User required")
    .isLength({ min: 3 })
    .withMessage("Too short User name"),

  check("phoneNumber")
    .notEmpty()
    .isMobilePhone(["ar-EG"])
    .withMessage("Invalid phone number only accepted Egy Phone numbers"),

  validatorMiddleware,
];
