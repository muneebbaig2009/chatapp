import { Router } from "express";
import * as ctrl from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.get("/me", requireAuth, ctrl.me);
router.patch("/me", requireAuth, ctrl.updateMe);
export default router;
