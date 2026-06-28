import { prisma } from "../config/prisma.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import type { RegisterInput, LoginInput } from "../validation/auth.schema.js";

function publicUser(u: { id: string; email: string; username: string; displayName: string; avatarUrl: string | null; about: string }) {
  return { id: u.id, email: u.email, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, about: u.about };
}

// "Remember me" unchecked gets a short-lived (1 day) backing token paired
// with a session cookie (see auth.controller.ts); checked gets the full
// configured TTL with a persistent cookie. No separate DB column for the
// choice — refresh() infers it back from how long the token was issued for.
const REMEMBER_ME_TTL_DAYS = env.refreshTokenTtlDays;
const NOT_REMEMBERED_TTL_DAYS = 1;
const REMEMBER_ME_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;

async function issueTokens(userId: string, rememberMe: boolean) {
  const accessToken = signAccessToken({ userId });
  const refreshToken = signRefreshToken({ userId });
  const ttlDays = rememberMe ? REMEMBER_ME_TTL_DAYS : NOT_REMEMBERED_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
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
  const tokens = await issueTokens(user.id, input.rememberMe ?? false);
  return { user: publicUser(user), ...tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new ApiError(401, "Invalid credentials");
  const ok = await comparePassword(input.password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid credentials");
  const tokens = await issueTokens(user.id, input.rememberMe ?? false);
  return { user: publicUser(user), ...tokens };
}

export async function refresh(oldToken: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token: oldToken } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new ApiError(401, "Invalid refresh token");
  }
  const rememberMe = stored.expiresAt.getTime() - stored.createdAt.getTime() > REMEMBER_ME_THRESHOLD_MS;
  // Rotate: delete old, issue new
  await prisma.refreshToken.deleteMany({ where: { token: oldToken } });
  const tokens = await issueTokens(stored.userId, rememberMe);
  return { ...tokens, rememberMe };
}

export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}
