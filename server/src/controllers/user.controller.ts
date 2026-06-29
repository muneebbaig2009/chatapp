import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import * as userService from "../services/user.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await userService.getMe(req.userId!));
});

export const updateMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { displayName, about, avatarUrl, showLastSeen, showOnlineStatus, showReadReceipts } = req.body ?? {};
  const data: Parameters<typeof userService.updateMe>[1] = {};

  if (displayName !== undefined) {
    if (typeof displayName !== "string") throw new ApiError(400, "displayName must be a string");
    data.displayName = displayName;
  }
  if (about !== undefined) {
    if (typeof about !== "string") throw new ApiError(400, "about must be a string");
    data.about = about;
  }
  if (avatarUrl !== undefined) {
    if (avatarUrl !== null && typeof avatarUrl !== "string") {
      throw new ApiError(400, "avatarUrl must be a string or null");
    }
    data.avatarUrl = avatarUrl;
  }
  if (showLastSeen !== undefined) {
    if (typeof showLastSeen !== "boolean") throw new ApiError(400, "showLastSeen must be a boolean");
    data.showLastSeen = showLastSeen;
  }
  if (showOnlineStatus !== undefined) {
    if (typeof showOnlineStatus !== "boolean") throw new ApiError(400, "showOnlineStatus must be a boolean");
    data.showOnlineStatus = showOnlineStatus;
  }
  if (showReadReceipts !== undefined) {
    if (typeof showReadReceipts !== "boolean") throw new ApiError(400, "showReadReceipts must be a boolean");
    data.showReadReceipts = showReadReceipts;
  }

  res.json(await userService.updateMe(req.userId!, data));
});
