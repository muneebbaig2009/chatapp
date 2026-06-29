import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/ApiError.js";

// Shared include shape so every chat-returning endpoint (direct or group)
// sends the same nested member/user data to the frontend.
const chatWithMembersInclude = {
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
          showOnlineStatus: true,
          showLastSeen: true,
        },
      },
    },
  },
  pinnedMessage: {
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  },
};

interface PrivacyAwareMember {
  userId: string;
  user: {
    isOnline: boolean;
    lastSeen: Date;
    showOnlineStatus?: boolean;
    showLastSeen?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Applies each OTHER member's own privacy preferences before handing chat
// data to `viewerId` — these settings only affect how YOU appear to
// others, never the viewer's own view of their own row. The raw
// preference fields are stripped afterward either way; a viewer reads
// their own settings via /users/me, not via chat member lists.
function sanitizeChatForViewer<T extends { members: PrivacyAwareMember[] }>(chat: T, viewerId: string): T {
  for (const member of chat.members) {
    const u = member.user;
    if (member.userId !== viewerId) {
      if (!u.showOnlineStatus) u.isOnline = false;
      if (!u.showLastSeen) u.lastSeen = null as unknown as Date;
    }
    delete u.showOnlineStatus;
    delete u.showLastSeen;
  }
  return chat;
}

function sanitizeChatsForViewer<T extends { members: PrivacyAwareMember[] }>(chats: T[], viewerId: string): T[] {
  return chats.map((c) => sanitizeChatForViewer(c, viewerId));
}

// Shared include shape for message-returning endpoints (createMessage,
// getMessages, and message.service.ts's edit/delete/forward actions) so the
// frontend always gets the same nested shape regardless of which action
// produced the message.
export const messageInclude = {
  sender: { select: { id: true, displayName: true, avatarUrl: true } },
  reactions: true,
  replyTo: { select: { id: true, content: true, senderId: true } },
  receipts: true,
};

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
    include: chatWithMembersInclude,
  });
  if (existing) return sanitizeChatForViewer(existing, userId);

  const created = await prisma.chat.create({
    data: {
      isGroup: false,
      members: { create: [{ userId }, { userId: otherUserId }] },
    },
    include: chatWithMembersInclude,
  });
  return sanitizeChatForViewer(created, userId);
}

export async function listChats(userId: string) {
  const chats = await prisma.chat.findMany({
    where: { members: { some: { userId } } },
    include: {
      ...chatWithMembersInclude,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return sanitizeChatsForViewer(chats, userId);
}

// Create a new group chat. The creator becomes an admin; everyone else
// listed joins as a regular member.
export async function createGroupChat(
  creatorId: string,
  name: string,
  memberIds: string[],
) {
  const trimmedName = name?.trim();
  if (!trimmedName) throw new ApiError(400, "Group name is required");

  const uniqueMemberIds = Array.from(
    new Set(memberIds.filter((id) => id && id !== creatorId)),
  );
  if (uniqueMemberIds.length === 0)
    throw new ApiError(400, "Select at least one member");

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueMemberIds } },
    select: { id: true },
  });
  if (users.length !== uniqueMemberIds.length)
    throw new ApiError(404, "One or more users not found");

  const created = await prisma.chat.create({
    data: {
      isGroup: true,
      name: trimmedName,
      members: {
        create: [
          { userId: creatorId, isAdmin: true },
          ...uniqueMemberIds.map((userId) => ({ userId, isAdmin: false })),
        ],
      },
    },
    include: chatWithMembersInclude,
  });
  return sanitizeChatForViewer(created, creatorId);
}

// Add new members to an existing group (admin only).
export async function addMembers(
  requesterId: string,
  chatId: string,
  memberIds: string[],
) {
  await assertAdmin(requesterId, chatId);

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!chat.isGroup) throw new ApiError(400, "Cannot add members to a direct chat");

  const existing = await prisma.chatMember.findMany({
    where: { chatId },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((m) => m.userId));
  const toAdd = Array.from(
    new Set(memberIds.filter((id) => id && !existingIds.has(id))),
  );
  if (toAdd.length === 0) throw new ApiError(400, "No new members to add");

  const users = await prisma.user.findMany({
    where: { id: { in: toAdd } },
    select: { id: true },
  });
  if (users.length !== toAdd.length)
    throw new ApiError(404, "One or more users not found");

  await prisma.chatMember.createMany({
    data: toAdd.map((userId) => ({ chatId, userId, isAdmin: false })),
  });

  const updated = await prisma.chat.findUniqueOrThrow({
    where: { id: chatId },
    include: chatWithMembersInclude,
  });
  return sanitizeChatForViewer(updated, requesterId);
}

// Remove a member from a group. Admins can remove anyone; a non-admin can
// only remove themselves (i.e. leave the group).
export async function removeMember(
  requesterId: string,
  chatId: string,
  targetUserId: string,
) {
  await assertMember(requesterId, chatId);
  if (requesterId !== targetUserId) await assertAdmin(requesterId, chatId);

  const target = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId: targetUserId } },
  });
  if (!target) throw new ApiError(404, "User is not a member of this chat");

  await prisma.chatMember.delete({
    where: { chatId_userId: { chatId, userId: targetUserId } },
  });

  const updated = await prisma.chat.findUniqueOrThrow({
    where: { id: chatId },
    include: chatWithMembersInclude,
  });
  return sanitizeChatForViewer(updated, requesterId);
}

// Promote or demote a member (admin only).
export async function setMemberAdmin(
  requesterId: string,
  chatId: string,
  targetUserId: string,
  isAdmin: boolean,
) {
  await assertAdmin(requesterId, chatId);

  const target = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId: targetUserId } },
  });
  if (!target) throw new ApiError(404, "User is not a member of this chat");

  await prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId: targetUserId } },
    data: { isAdmin },
  });

  const updated = await prisma.chat.findUniqueOrThrow({
    where: { id: chatId },
    include: chatWithMembersInclude,
  });
  return sanitizeChatForViewer(updated, requesterId);
}

// Update group metadata (admin only).
export async function updateGroup(
  requesterId: string,
  chatId: string,
  data: { name?: string; description?: string | null; iconUrl?: string | null },
) {
  await assertAdmin(requesterId, chatId);

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!chat.isGroup) throw new ApiError(400, "Cannot update a direct chat");

  const update: { name?: string; description?: string | null; iconUrl?: string | null } = {};
  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) throw new ApiError(400, "Group name is required");
    update.name = trimmed;
  }
  if (data.description !== undefined) update.description = data.description;
  if (data.iconUrl !== undefined) update.iconUrl = data.iconUrl;

  const updated = await prisma.chat.update({
    where: { id: chatId },
    data: update,
    include: chatWithMembersInclude,
  });
  return sanitizeChatForViewer(updated, requesterId);
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
      hiddenFor: { none: { userId } },
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: { ...messageInclude, starredBy: { where: { userId } } },
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
    include: messageInclude,
  });
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });
  return message;
}

// Pinning a message replaces any existing pin (one pinned message per chat).
// Any member can pin/unpin in a direct chat; only admins can in a group.
export async function pinMessage(userId: string, chatId: string, messageId: string) {
  await assertPinPermission(userId, chatId);

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.chatId !== chatId) throw new ApiError(404, "Message not found in this chat");
  if (message.isDeleted) throw new ApiError(400, "Cannot pin a deleted message");

  const updated = await prisma.chat.update({
    where: { id: chatId },
    data: { pinnedMessageId: messageId },
    include: chatWithMembersInclude,
  });
  return sanitizeChatForViewer(updated, userId);
}

export async function unpinMessage(userId: string, chatId: string) {
  await assertPinPermission(userId, chatId);
  const updated = await prisma.chat.update({
    where: { id: chatId },
    data: { pinnedMessageId: null },
    include: chatWithMembersInclude,
  });
  return sanitizeChatForViewer(updated, userId);
}

async function assertPinPermission(userId: string, chatId: string) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) throw new ApiError(404, "Chat not found");
  if (chat.isGroup) await assertAdmin(userId, chatId);
  else await assertMember(userId, chatId);
}

export async function assertMember(userId: string, chatId: string) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) throw new ApiError(403, "You are not a member of this chat");
  return member;
}

export async function assertAdmin(userId: string, chatId: string) {
  const member = await assertMember(userId, chatId);
  if (!member.isAdmin) throw new ApiError(403, "Only group admins can do this");
  return member;
}

export async function memberIds(chatId: string): Promise<string[]> {
  const members = await prisma.chatMember.findMany({
    where: { chatId },
    select: { userId: true },
  });
  return members.map((m: { userId: string }) => m.userId);
}
