import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Missing or invalid Authorization header"));
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.userId = payload.userId;
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}
