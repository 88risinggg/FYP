const express = require("express");
const {
  getServerHealth,
  getDatabaseHealth
} = require("../controllers/healthController");

const router = express.Router();

router.get("/", getServerHealth);
router.get("/database", getDatabaseHealth);

module.exports = router;

