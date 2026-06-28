import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/ApiError.js";

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;
const userSelect = { id: true, displayName: true, avatarUrl: true } as const;

interface UserSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface StatusEntry {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption: string | null;
  createdAt: Date;
  expiresAt: Date;
  viewedByMe: boolean;
  viewCount: number;
}

// "Contacts" = anyone who shares at least one chat with this user. There's
// no separate contacts/friends model, so this is the natural audience for
// status visibility.
export async function getContactIds(userId: string): Promise<string[]> {
  const myChats = await prisma.chatMember.findMany({ where: { userId }, select: { chatId: true } });
  const chatIds = myChats.map((c) => c.chatId);
  if (chatIds.length === 0) return [];
  const members = await prisma.chatMember.findMany({
    where: { chatId: { in: chatIds }, userId: { not: userId } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return members.map((m) => m.userId);
}

export async function createStatus(
  userId: string,
  mediaUrl: string,
  mediaType: "IMAGE" | "VIDEO",
  caption?: string,
) {
  return prisma.status.create({
    data: {
      userId,
      mediaUrl,
      mediaType,
      caption: caption?.trim() || null,
      expiresAt: new Date(Date.now() + STATUS_TTL_MS),
    },
    include: { user: { select: userSelect } },
  });
}

export async function deleteStatus(userId: string, statusId: string) {
  const status = await prisma.status.findUnique({ where: { id: statusId } });
  if (!status) throw new ApiError(404, "Status not found");
  if (status.userId !== userId) throw new ApiError(403, "You can only delete your own status");
  await prisma.status.delete({ where: { id: statusId } });
}

export async function viewStatus(userId: string, statusId: string) {
  const status = await prisma.status.findUnique({ where: { id: statusId } });
  if (!status) throw new ApiError(404, "Status not found");
  if (status.expiresAt < new Date()) throw new ApiError(404, "Status has expired");
  if (status.userId === userId) return; // no need to track viewing your own
  await prisma.statusView.upsert({
    where: { statusId_userId: { statusId, userId } },
    create: { statusId, userId },
    update: {},
  });
}

export async function getStatusFeed(userId: string) {
  const contactIds = await getContactIds(userId);
  const authorIds = [userId, ...contactIds];

  const statuses = await prisma.status.findMany({
    where: { userId: { in: authorIds }, expiresAt: { gt: new Date() } },
    include: {
      user: { select: userSelect },
      views: { select: { userId: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, { user: UserSummary; statuses: StatusEntry[] }>();
  for (const status of statuses) {
    if (!groups.has(status.userId)) {
      groups.set(status.userId, { user: status.user, statuses: [] });
    }
    groups.get(status.userId)!.statuses.push({
      id: status.id,
      mediaUrl: status.mediaUrl,
      mediaType: status.mediaType,
      caption: status.caption,
      createdAt: status.createdAt,
      expiresAt: status.expiresAt,
      viewedByMe: status.views.some((v) => v.userId === userId),
      viewCount: status.views.length,
    });
  }

  const mineGroup = groups.get(userId) ?? null;
  groups.delete(userId);

  const others = Array.from(groups.values())
    .map((g) => ({
      user: g.user,
      statuses: g.statuses,
      hasUnseen: g.statuses.some((s) => !s.viewedByMe),
    }))
    .sort((a, b) => {
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return (
        b.statuses[b.statuses.length - 1].createdAt.getTime() -
        a.statuses[a.statuses.length - 1].createdAt.getTime()
      );
    });

  return { mine: mineGroup, others };
}
