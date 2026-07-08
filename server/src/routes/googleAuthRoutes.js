const express = require("express");
const { googleLogin, googleCallback } = require("../controllers/googleAuthController");

const router = express.Router();

// Public endpoints - no auth required
router.get("/login", googleLogin);
router.get("/callback", googleCallback);

module.exports = router;
