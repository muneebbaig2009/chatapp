import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import * as pushService from "../services/push.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const subscribe = asyncHandler(async (req: AuthRequest, res: Response) => {
  await pushService.saveSubscription(req.userId!, req.body);
  res.status(201).json({ ok: true });
});

export const unsubscribe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint !== "string") throw new ApiError(400, "endpoint is required");
  await pushService.removeSubscription(req.userId!, endpoint);
  res.json({ ok: true });
});
