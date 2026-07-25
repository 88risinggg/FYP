const express = require("express");

const {
  completeFirstLogin,
  login,
  resendLoginOtp,
  verifyLoginOtp
} = require("../controllers/authController");

const router = express.Router();

router.post("/login", login);
router.post("/complete-first-login", completeFirstLogin);
router.post("/login/verify-otp", verifyLoginOtp);
router.post("/login/resend-otp", resendLoginOtp);

module.exports = router;

