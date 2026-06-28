import { Router } from "express";
import * as ctrl from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.get("/", ctrl.listChats);
router.get("/search/users", ctrl.searchUsers);
router.post("/direct/:userId", ctrl.openDirect);
router.post("/group", ctrl.createGroup);
router.get("/:chatId/messages", ctrl.getMessages);
router.post("/:chatId/members", ctrl.addMembers);
router.delete("/:chatId/members/:userId", ctrl.removeMember);
router.patch("/:chatId/members/:userId/admin", ctrl.updateMemberAdmin);
router.post("/:chatId/pin", ctrl.pinMessage);
router.delete("/:chatId/pin", ctrl.unpinMessage);
router.patch("/:chatId", ctrl.updateGroup);
export default router;
