const { validationResult } = require("express-validator");
//@ decs find the validation errors
const validatorMiddleWare = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
module.exports = validatorMiddleWare;
