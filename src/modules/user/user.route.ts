import { Router } from "express";
import { userController } from "./user.controller.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import Auth from "../../middleware/Auth.ts";
import { UserRole } from "../../generated/prisma/enums.ts";

import {
  changePasswordValidationSchema,
  updateMyProfileValidationSchema,
  updateUserStatusValidationSchema,
  updateUserValidationSchema,
  userQueryValidationSchema,
} from "./user.validation.ts";

const router = Router();

router.get(
  "/",
  Auth(UserRole.ADMIN),
  validateRequest(userQueryValidationSchema),
  userController.GetAllUsers,
);

router.patch(
  "/me",
  Auth(),
  validateRequest(updateMyProfileValidationSchema),
  userController.UpdateMyProfile,
);

router.patch(
  "/me/change-password",
  Auth(),
  validateRequest(changePasswordValidationSchema),
  userController.ChangeMyPassword,
);

router.get("/:id", Auth(UserRole.ADMIN), userController.GetUserById);

router.patch(
  "/:id",
  Auth(UserRole.ADMIN),
  validateRequest(updateUserValidationSchema),
  userController.UpdateUser,
);

router.patch(
  "/:id/status",
  Auth(UserRole.ADMIN),
  validateRequest(updateUserStatusValidationSchema),
  userController.UpdateUserStatus,
);

export const userRoutes = router;
