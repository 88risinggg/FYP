const express = require("express");

const {
  getUser,
  getUsers,
  patchUserPassword,
  patchUserStatus,
  postUser,
  putUser
} = require("../controllers/adminUserController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireRole("Admin"));

router.get("/", getUsers);
router.get("/:id", getUser);
router.post("/", postUser);
router.put("/:id", putUser);
router.patch("/:id/status", patchUserStatus);
router.patch("/:id/reset-password", patchUserPassword);

module.exports = router;
