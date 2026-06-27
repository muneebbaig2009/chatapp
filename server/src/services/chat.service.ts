import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/ApiError.js";

// Find existing 1-to-1 chat between two users, or create one.
export async function getOrCreateDirectChat(
  userId: string,
  otherUserId: string,
) {
  if (userId === otherUserId)
    throw new ApiError(400, "Cannot chat with yourself");
  const other = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!other) throw new ApiError(404, "User not found");

  const existing = await prisma.chat.findFirst({
    where: {
      isGroup: false,
      members: { every: { userId: { in: [userId, otherUserId] } } },
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: otherUserId } } },
      ],
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
              isOnline: true,
              lastSeen: true,
            },
          },
        },
      },
    },
  });
  if (existing) return existing;

  return prisma.chat.create({
    data: {
      isGroup: false,
      members: { create: [{ userId }, { userId: otherUserId }] },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
              isOnline: true,
              lastSeen: true,
            },
          },
        },
      },
    },
  });
}

export async function listChats(userId: string) {
  return prisma.chat.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
              isOnline: true,
              lastSeen: true,
            },
          },
        },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getMessages(
  userId: string,
  chatId: string,
  limit = 50,
  before?: string,
) {
  await assertMember(userId, chatId);
  return prisma.message.findMany({
    where: {
      chatId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      reactions: true,
      replyTo: { select: { id: true, content: true, senderId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function createMessage(
  senderId: string,
  chatId: string,
  data: {
    content?: string;
    type?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    replyToId?: string;
  },
) {
  await assertMember(senderId, chatId);
  const message = await prisma.message.create({
    data: {
      chatId,
      senderId,
      content: data.content,
      type: (data.type as any) || "TEXT",
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      replyToId: data.replyToId,
    },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      reactions: true,
    },
  });
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });
  return message;
}

export async function assertMember(userId: string, chatId: string) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) throw new ApiError(403, "You are not a member of this chat");
  return member;
}

export async function memberIds(chatId: string): Promise<string[]> {
  const members = await prisma.chatMember.findMany({
    where: { chatId },
    select: { userId: true },
  });
  return members.map((m: { userId: string }) => m.userId);
}
