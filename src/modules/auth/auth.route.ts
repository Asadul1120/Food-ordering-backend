import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { authController } from "./auth.controller.ts";
import {
  loginValidationSchema,
  registerValidationSchema,
} from "./auth.validation.ts";
import Auth from "../../middleware/Auth.ts";

const router = Router();

router.post(
  "/register",
  validateRequest(registerValidationSchema),
  authController.Register,
);

router.post(
  "/login",
  validateRequest(loginValidationSchema),
  authController.Login,
);

router.get("/me", Auth(), authController.getMe);

router.post("/logout", authController.Logout);

router.post("/refresh-token", authController.refreshToken);

export const authRoutes = router;
