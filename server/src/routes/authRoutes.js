const express = require("express");

const { completeFirstLogin, login } = require("../controllers/authController");

const router = express.Router();

router.post("/login", login);
router.post("/complete-first-login", completeFirstLogin);

module.exports = router;

