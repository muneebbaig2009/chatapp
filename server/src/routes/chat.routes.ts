import { Router } from "express";
import * as ctrl from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.get("/", ctrl.listChats);
router.get("/search/users", ctrl.searchUsers);
router.post("/direct/:userId", ctrl.openDirect);
router.get("/:chatId/messages", ctrl.getMessages);
export default router;
