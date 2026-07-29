/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Defines the available auth Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
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

