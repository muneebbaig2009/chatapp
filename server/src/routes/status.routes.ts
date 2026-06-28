import { Router } from "express";
import * as ctrl from "../controllers/status.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.get("/", ctrl.getFeed);
router.post("/", ctrl.createStatus);
router.delete("/:statusId", ctrl.deleteStatus);
router.post("/:statusId/view", ctrl.viewStatus);
export default router;
