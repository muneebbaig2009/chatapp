import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import * as callService from "../services/call.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getIceServers = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json(await callService.fetchIceServers());
});

export const getCallHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await callService.getCallHistory(req.userId!));
});
