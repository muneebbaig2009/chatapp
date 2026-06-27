import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import * as chatService from "../services/chat.service.js";
import * as userService from "../services/user.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { getIO } from "../sockets/index.js";

// Notify every current member (plus anyone who just lost membership, e.g. a
// removed/leaving user) so their UI refreshes via the existing personal room.
function notifyGroupUpdate(
  chat: { id: string; members: { userId: string }[] },
  extraUserIds: string[] = [],
) {
  const io = getIO();
  const recipientIds = new Set([...chat.members.map((m) => m.userId), ...extraUserIds]);
  for (const userId of recipientIds) {
    io.to(`user:${userId}`).emit("group:updated", chat);
  }
}

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

export const createGroup = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, memberIds } = req.body ?? {};
  if (typeof name !== "string" || !Array.isArray(memberIds)) {
    throw new ApiError(400, "name and memberIds are required");
  }
  const chat = await chatService.createGroupChat(req.userId!, name, memberIds.map(String));
  notifyGroupUpdate(chat);
  res.status(201).json(chat);
});

export const addMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { memberIds } = req.body ?? {};
  if (!Array.isArray(memberIds)) throw new ApiError(400, "memberIds is required");
  const chat = await chatService.addMembers(
    req.userId!,
    String(req.params.chatId),
    memberIds.map(String),
  );
  notifyGroupUpdate(chat);
  res.json(chat);
});

export const removeMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const chatId = String(req.params.chatId);
  const targetUserId = String(req.params.userId);
  const chat = await chatService.removeMember(req.userId!, chatId, targetUserId);
  notifyGroupUpdate(chat, [targetUserId]);
  res.json(chat);
});

export const updateMemberAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { isAdmin } = req.body ?? {};
  if (typeof isAdmin !== "boolean") throw new ApiError(400, "isAdmin must be a boolean");
  const chat = await chatService.setMemberAdmin(
    req.userId!,
    String(req.params.chatId),
    String(req.params.userId),
    isAdmin,
  );
  notifyGroupUpdate(chat);
  res.json(chat);
});

export const updateGroup = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, description, iconUrl } = req.body ?? {};
  const chat = await chatService.updateGroup(req.userId!, String(req.params.chatId), {
    name,
    description,
    iconUrl,
  });
  notifyGroupUpdate(chat);
  res.json(chat);
});
