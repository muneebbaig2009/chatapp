import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import * as statusService from "../services/status.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { getIO } from "../sockets/index.js";

export const getFeed = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await statusService.getStatusFeed(req.userId!));
});

export const createStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { mediaUrl, mediaType, caption } = req.body ?? {};
  if (typeof mediaUrl !== "string" || (mediaType !== "IMAGE" && mediaType !== "VIDEO")) {
    throw new ApiError(400, "mediaUrl and mediaType are required");
  }
  const status = await statusService.createStatus(
    req.userId!,
    mediaUrl,
    mediaType,
    typeof caption === "string" ? caption : undefined,
  );

  const contactIds = await statusService.getContactIds(req.userId!);
  const io = getIO();
  for (const contactId of contactIds) {
    io.to(`user:${contactId}`).emit("status:new", status);
  }
  res.status(201).json(status);
});

export const deleteStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const statusId = String(req.params.statusId);
  await statusService.deleteStatus(req.userId!, statusId);

  const contactIds = await statusService.getContactIds(req.userId!);
  const io = getIO();
  for (const contactId of contactIds) {
    io.to(`user:${contactId}`).emit("status:deleted", { statusId, userId: req.userId });
  }
  res.json({ ok: true });
});

export const viewStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  await statusService.viewStatus(req.userId!, String(req.params.statusId));
  res.json({ ok: true });
});
