import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import * as chatService from "./chat.service.js";
import { messageInclude } from "./chat.service.js";

async function loadMessageAsMember(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new ApiError(404, "Message not found");
  await chatService.assertMember(userId, message.chatId);
  return message;
}

export async function editMessage(userId: string, messageId: string, content: string) {
  const message = await loadMessageAsMember(userId, messageId);
  if (message.senderId !== userId) throw new ApiError(403, "You can only edit your own messages");
  if (message.isDeleted) throw new ApiError(400, "Cannot edit a deleted message");

  const trimmed = content.trim();
  if (!trimmed) throw new ApiError(400, "Message content is required");

  return prisma.message.update({
    where: { id: messageId },
    data: { content: trimmed, isEdited: true },
    include: messageInclude,
  });
}

// Sender can always delete their own message for everyone; in a group, an
// admin can also delete anyone's message (moderation).
export async function deleteForEveryone(userId: string, messageId: string) {
  const message = await loadMessageAsMember(userId, messageId);
  if (message.isDeleted) throw new ApiError(400, "Message has already been deleted");

  if (message.senderId !== userId) {
    const chat = await prisma.chat.findUnique({ where: { id: message.chatId } });
    if (!chat?.isGroup) throw new ApiError(403, "You can only delete your own messages");
    await chatService.assertAdmin(userId, message.chatId);
  }

  return prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, content: null, fileUrl: null, fileName: null, fileSize: null },
    include: messageInclude,
  });
}

// Hides the message from this user's view only — everyone else still sees it.
export async function deleteForMe(userId: string, messageId: string) {
  const message = await loadMessageAsMember(userId, messageId);
  await prisma.hiddenMessage.upsert({
    where: { userId_messageId: { userId, messageId } },
    create: { userId, messageId },
    update: {},
  });
  return { messageId: message.id };
}

export async function toggleStar(userId: string, messageId: string) {
  const message = await loadMessageAsMember(userId, messageId);
  const existing = await prisma.starredMessage.findUnique({
    where: { userId_messageId: { userId, messageId } },
  });
  if (existing) {
    await prisma.starredMessage.delete({ where: { id: existing.id } });
    return { messageId: message.id, starred: false };
  }
  await prisma.starredMessage.create({ data: { userId, messageId } });
  return { messageId: message.id, starred: true };
}

export async function forwardMessage(userId: string, messageId: string, targetChatIds: string[]) {
  const source = await loadMessageAsMember(userId, messageId);
  if (source.isDeleted) throw new ApiError(400, "Cannot forward a deleted message");

  const uniqueChatIds = Array.from(new Set(targetChatIds.filter(Boolean)));
  if (uniqueChatIds.length === 0) throw new ApiError(400, "Select at least one chat to forward to");

  // Validate access to every target before creating anything, so a forward
  // either fully succeeds or fails without partial side effects.
  for (const chatId of uniqueChatIds) {
    await chatService.assertMember(userId, chatId);
  }

  const created = [];
  for (const chatId of uniqueChatIds) {
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: source.content,
        type: source.type,
        fileUrl: source.fileUrl,
        fileName: source.fileName,
        fileSize: source.fileSize,
        forwardedFromId: source.id,
      },
      include: messageInclude,
    });
    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
    created.push(message);
  }
  return created;
}
