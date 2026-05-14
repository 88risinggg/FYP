import express from "express";
import { auditLogs } from "../data.js";
import { allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.get("/", allowRoles("Admin"), (_req, res) => res.json(auditLogs));

export default router;
