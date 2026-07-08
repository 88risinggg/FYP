const express = require("express");
const { singpassLogin, singpassCallback, singpassDemo, getJwks } = require("../controllers/singpassController");

const router = express.Router();

// Public endpoints - no auth required
router.get("/login", singpassLogin);
router.get("/callback", singpassCallback);
router.get("/jwks", getJwks);
router.post("/demo", singpassDemo);

module.exports = router;
