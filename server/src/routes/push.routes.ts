import { Router } from "express";
import * as ctrl from "../controllers/push.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.post("/subscribe", ctrl.subscribe);
router.post("/unsubscribe", ctrl.unsubscribe);
export default router;
