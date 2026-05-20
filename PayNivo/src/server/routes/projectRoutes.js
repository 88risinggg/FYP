import { Router } from "express";
import { projectPlan } from "../data/projectPlan.js";

const router = Router();

router.get("/alignment", (_req, res) => {
  res.json(projectPlan);
});

export default router;
