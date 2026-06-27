import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../validation/auth.schema.js";

const router = Router();
router.post("/register", validate(registerSchema), ctrl.register);
router.post("/login", validate(loginSchema), ctrl.login);
router.post("/refresh", ctrl.refresh);
router.post("/logout", ctrl.logout);
export default router;
