const express = require("express");
const { requestOtp, verifyOtp } = require("../controllers/otpAuthController");

const router = express.Router();

// Public endpoints - no auth required
router.post("/request", requestOtp);
router.post("/verify", verifyOtp);

module.exports = router;
