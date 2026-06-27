import { prisma } from "../config/prisma.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import type { RegisterInput, LoginInput } from "../validation/auth.schema.js";

function publicUser(u: { id: string; email: string; username: string; displayName: string; avatarUrl: string | null; about: string }) {
  return { id: u.id, email: u.email, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, about: u.about };
}

async function issueTokens(userId: string) {
  const accessToken = signAccessToken({ userId });
  const refreshToken = signRefreshToken({ userId });
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId, expiresAt } });
  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput) {
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
  });
  if (exists) throw new ApiError(409, "Email or username already in use");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      passwordHash: await hashPassword(input.password),
    },
  });
  const tokens = await issueTokens(user.id);
  return { user: publicUser(user), ...tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new ApiError(401, "Invalid credentials");
  const ok = await comparePassword(input.password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid credentials");
  const tokens = await issueTokens(user.id);
  return { user: publicUser(user), ...tokens };
}

export async function refresh(oldToken: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token: oldToken } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new ApiError(401, "Invalid refresh token");
  }
  // Rotate: delete old, issue new
await prisma.refreshToken.deleteMany({ where: { token: oldToken } });
  return issueTokens(stored.userId);
}

export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}
