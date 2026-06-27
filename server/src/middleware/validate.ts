import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { ApiError } from "../utils/ApiError.js";

export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return next(new ApiError(400, msg));
    }
    req.body = result.data;
    next();
  };
