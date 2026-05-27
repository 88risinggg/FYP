const express = require("express");
const { getCustomers } = require("../controllers/customerController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.get("/", getCustomers);

module.exports = router;
