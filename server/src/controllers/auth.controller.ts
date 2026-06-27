import type { Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

const isProd = process.env.NODE_ENV === "production";
const cookieOpts = {
  httpOnly: true,
  secure: isProd,                       // HTTPS only in prod
  sameSite: isProd ? "none" as const : "lax" as const,
  maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  res.cookie("refreshToken", refreshToken, cookieOpts);
  res.status(201).json({ user, accessToken });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  res.cookie("refreshToken", refreshToken, cookieOpts);
  res.json({ user, accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, "No refresh token");
  const { accessToken, refreshToken } = await authService.refresh(token);
  res.cookie("refreshToken", refreshToken, cookieOpts);
  res.json({ accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) await authService.logout(token);
  res.clearCookie("refreshToken", { path: "/api/auth" });
  res.json({ message: "Logged out" });
});
