const express = require("express");
const { telegramInit, telegramPoll } = require("../controllers/telegramAuthController");

const router = express.Router();

// Public endpoints - no auth required
router.get("/init", telegramInit);
router.get("/poll", telegramPoll);

module.exports = router;
