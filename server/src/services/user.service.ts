import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/ApiError.js";

const meSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  about: true,
  isOnline: true,
  lastSeen: true,
  showLastSeen: true,
  showOnlineStatus: true,
  showReadReceipts: true,
};

export async function searchUsers(currentUserId: string, q: string) {
  if (!q.trim()) return [];
  return prisma.user.findMany({
    where: {
      id: { not: currentUserId },
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, displayName: true, avatarUrl: true, about: true },
    take: 20,
  });
}

export async function getMe(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: meSelect });
}

export async function updateMe(
  userId: string,
  data: {
    displayName?: string;
    about?: string;
    avatarUrl?: string | null;
    showLastSeen?: boolean;
    showOnlineStatus?: boolean;
    showReadReceipts?: boolean;
  },
) {
  const update: {
    displayName?: string;
    about?: string;
    avatarUrl?: string | null;
    showLastSeen?: boolean;
    showOnlineStatus?: boolean;
    showReadReceipts?: boolean;
  } = {};

  if (data.displayName !== undefined) {
    const trimmed = data.displayName.trim();
    if (!trimmed) throw new ApiError(400, "Display name is required");
    if (trimmed.length > 50) throw new ApiError(400, "Display name must be 50 characters or fewer");
    update.displayName = trimmed;
  }
  if (data.about !== undefined) {
    if (data.about.length > 150) throw new ApiError(400, "About must be 150 characters or fewer");
    update.about = data.about;
  }
  if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl;
  if (data.showLastSeen !== undefined) update.showLastSeen = data.showLastSeen;
  if (data.showOnlineStatus !== undefined) update.showOnlineStatus = data.showOnlineStatus;
  if (data.showReadReceipts !== undefined) update.showReadReceipts = data.showReadReceipts;

  return prisma.user.update({ where: { id: userId }, data: update, select: meSelect });
}
