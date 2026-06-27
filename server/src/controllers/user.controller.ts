import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import * as userService from "../services/user.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await userService.getMe(req.userId!));
});
