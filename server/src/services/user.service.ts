import { prisma } from "../config/prisma.js";

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
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, about: true, isOnline: true, lastSeen: true },
  });
}
