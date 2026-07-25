const express = require("express");

const { completeFirstLogin, login } = require("../controllers/authController");
const registrationController = require("../controllers/registrationController");

const router = express.Router();

router.post("/login", login);
router.post("/complete-first-login", completeFirstLogin);
router.get("/registration/status", registrationController.getRegistrationStatus);
router.post("/registration/start", registrationController.startRegistration);
router.post("/registration/verify-email", registrationController.verifyEmail);
router.post("/registration/resend-otp", registrationController.resendRegistrationOtp);

module.exports = router;

