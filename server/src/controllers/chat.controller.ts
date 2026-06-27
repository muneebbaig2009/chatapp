import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import * as chatService from "../services/chat.service.js";
import * as userService from "../services/user.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listChats = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await chatService.listChats(req.userId!));
});

export const openDirect = asyncHandler(async (req: AuthRequest, res: Response) => {
  const chat = await chatService.getOrCreateDirectChat(req.userId!, String(req.params.userId));
  res.json(chat);
});

export const getMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const before = typeof req.query.before === "string" ? req.query.before : undefined;
  const msgs = await chatService.getMessages(req.userId!, String(req.params.chatId), 50, before);
  res.json(msgs.reverse());
});

export const searchUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json(await userService.searchUsers(req.userId!, q));
});
