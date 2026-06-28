import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import * as messageService from "../services/message.service.js";
import * as chatService from "../services/chat.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { getIO } from "../sockets/index.js";

async function notifyChatMembers(chatId: string, event: string, payload: unknown) {
  const io = getIO();
  const members = await chatService.memberIds(chatId);
  for (const memberId of members) {
    io.to(`user:${memberId}`).emit(event, payload);
  }
}

export const editMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { content } = req.body ?? {};
  if (typeof content !== "string") throw new ApiError(400, "content is required");
  const message = await messageService.editMessage(req.userId!, String(req.params.messageId), content);
  await notifyChatMembers(message.chatId, "message:edited", message);
  res.json(message);
});

export const deleteForEveryone = asyncHandler(async (req: AuthRequest, res: Response) => {
  const message = await messageService.deleteForEveryone(req.userId!, String(req.params.messageId));
  await notifyChatMembers(message.chatId, "message:deleted", message);
  res.json(message);
});

export const deleteForMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await messageService.deleteForMe(req.userId!, String(req.params.messageId)));
});

export const toggleStar = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await messageService.toggleStar(req.userId!, String(req.params.messageId)));
});

export const forwardMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { chatIds } = req.body ?? {};
  if (!Array.isArray(chatIds)) throw new ApiError(400, "chatIds is required");
  const messages = await messageService.forwardMessage(
    req.userId!,
    String(req.params.messageId),
    chatIds.map(String),
  );
  for (const message of messages) {
    await notifyChatMembers(message.chatId, "message:new", message);
  }
  res.status(201).json(messages);
});
