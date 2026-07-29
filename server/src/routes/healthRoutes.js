/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Defines the available health Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");
const {
  getServerHealth,
  getDatabaseHealth
} = require("../controllers/healthController");

const router = express.Router();

router.get("/", getServerHealth);
router.get("/database", getDatabaseHealth);

module.exports = router;

