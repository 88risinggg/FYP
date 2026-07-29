/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Defines the available google Auth Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");
const { googleLogin, googleCallback } = require("../controllers/googleAuthController");

const router = express.Router();

// Public endpoints - no auth required
router.get("/login", googleLogin);
router.get("/callback", googleCallback);

module.exports = router;
