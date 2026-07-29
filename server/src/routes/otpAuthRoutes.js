/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Defines the available OTP Auth Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");
const { requestOtp, verifyOtp } = require("../controllers/otpAuthController");

const router = express.Router();

// Public endpoints - no auth required
router.post("/request", requestOtp);
router.post("/verify", verifyOtp);

module.exports = router;
