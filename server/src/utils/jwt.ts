import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessPayload {
  userId: string;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessPayload;
}

export function signRefreshToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d` as SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): AccessPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as AccessPayload;
}
