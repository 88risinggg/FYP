const express = require("express");
const { getProfileByUserId, upsertProfileByUserId } = require("../controllers/profileController");

const router = express.Router();

router.get("/:userId", getProfileByUserId);
router.put("/:userId", upsertProfileByUserId);

module.exports = router;
