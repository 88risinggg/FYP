const express = require("express");

const {
  completeFirstLogin,
  login,
  resendLoginOtp,
  verifyLoginOtp
} = require("../controllers/authController");

const {
  getRegistrationStatus,
  startRegistration,
  verifyEmail,
  resendRegistrationOtp
} = require("../controllers/registrationController");

const router = express.Router();

router.post("/login", login);
router.post("/complete-first-login", completeFirstLogin);
router.post("/login/verify-otp", verifyLoginOtp);
router.post("/login/resend-otp", resendLoginOtp);

// Registration routes
router.get("/registration/status", getRegistrationStatus);
router.post("/registration/start", startRegistration);
router.post("/registration/verify-email", verifyEmail);
router.post("/registration/resend-otp", resendRegistrationOtp);

module.exports = router;

