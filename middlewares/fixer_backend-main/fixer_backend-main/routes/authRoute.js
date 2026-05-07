const express = require("express");
const { verifyToken } = require("../middlewares/varifyToken");
const {
  signupValidator,
  loginByCodeValidator,
} = require("../utils/validator/authValidator");

const {
  signup,
  loginByCarCode,
  forgotPassword,
  loginByMail,
  forgotPasswordForAdmin,
  resetPasswordForAdmin,
  setEmailAndPassword,
  verifyLogin,
} = require("../services/authService");

const router = express.Router();

router.post("/signup", signupValidator, signup);
router.post("/admin/login", loginByMail);
router.post("/loginByCode", loginByCodeValidator, loginByCarCode);
router.post("/forgotPassword", forgotPassword);
router.post("/admin/forgotPassword", forgotPasswordForAdmin);
router.post("/admin/resetPassword", resetPasswordForAdmin);
router.post("/admin/firstCome", setEmailAndPassword);
router.get("/admin/verifyLogin", verifyLogin);
//router.post("/verifyResetCode", verifyPassResetCode);
//router.put("/resetPassword", resetPassword);

module.exports = router;
