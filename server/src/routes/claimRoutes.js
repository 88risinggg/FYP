const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const { submitClaim, listClaims, reviewByHr, processByFinance, downloadProof } = require("../controllers/claimController");
require("../models/claimModel");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "..", "uploads", "claim-proofs");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    callback(allowed.includes(file.mimetype) ? null : new Error("Only PDF, JPG, and PNG files are allowed"), allowed.includes(file.mimetype));
  }
});

function proofUpload(req, res, next) {
  upload.single("proof")(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE" ? "Proof file must not exceed 5MB" : error.message;
    return res.status(400).json({ message });
  });
}

router.post("/", authenticateToken, allowRoles("Staff"), proofUpload, submitClaim);
router.get("/", authenticateToken, allowRoles("Staff", "HR", "Finance", "Admin"), listClaims);
router.get("/:id/proof", authenticateToken, allowRoles("Staff", "HR", "Finance", "Admin"), downloadProof);
router.put("/:id/hr/:action", authenticateToken, allowRoles("HR"), reviewByHr);
router.put("/:id/finance/:action", authenticateToken, allowRoles("Finance"), processByFinance);

module.exports = router;
