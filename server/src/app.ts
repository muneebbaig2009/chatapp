import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import userRoutes from "./routes/user.routes.js";
import { errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Rate-limit auth endpoints to slow brute force.
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/chats", chatRoutes);

  app.use(errorHandler);
  return app;
}
