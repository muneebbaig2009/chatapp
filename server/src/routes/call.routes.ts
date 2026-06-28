import { Router } from "express";
import * as ctrl from "../controllers/call.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.get("/ice-servers", ctrl.getIceServers);
router.get("/", ctrl.getCallHistory);
export default router;
