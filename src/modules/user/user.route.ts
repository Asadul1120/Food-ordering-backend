import { Router } from "express";

import { userController } from "./user.controller.ts";

import { validateRequest } from "../../middleware/validateRequest.ts";
import Auth from "../../middleware/Auth.ts";

import { userQueryValidationSchema } from "./user.validation.ts";
import { UserRole } from "../../generated/prisma/enums.ts";

const router = Router();

router.get(
  "/",
  Auth(UserRole.ADMIN),
  validateRequest(userQueryValidationSchema),
  userController.GetAllUsers,
);

router.get("/:id", Auth(UserRole.ADMIN), userController.GetUserById);

export const userRoutes = router;
