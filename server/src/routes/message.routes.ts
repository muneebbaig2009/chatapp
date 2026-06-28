import { Router } from "express";
import * as ctrl from "../controllers/message.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.patch("/:messageId", ctrl.editMessage);
router.delete("/:messageId", ctrl.deleteForEveryone);
router.delete("/:messageId/me", ctrl.deleteForMe);
router.post("/:messageId/star", ctrl.toggleStar);
router.post("/:messageId/forward", ctrl.forwardMessage);
export default router;
