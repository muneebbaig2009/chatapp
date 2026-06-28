import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";
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
  // jwt.sign's iat has only second-level granularity, so two refresh calls
  // for the same user within the same second would otherwise produce an
  // identical token string — and the DB's unique constraint on `token`
  // rejects the second insert. A random jti guarantees uniqueness.
  return jwt.sign({ ...payload, jti: randomUUID() }, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d` as SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): AccessPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as AccessPayload;
}
