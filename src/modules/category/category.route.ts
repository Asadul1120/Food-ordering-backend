import { Router } from "express";
import { categoryController } from "./category.controller.ts";
import Auth from "../../middleware/Auth.ts";
import { UserRole } from "../../generated/prisma/enums.ts";
import { uploadCategoryImage } from "../../middleware/upload.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { createCategoryValidationSchema, updateCategoryValidationSchema } from "./category.validation.ts";

const router = Router();

router.post(
  "/",
  Auth(UserRole.ADMIN),
  uploadCategoryImage,
  validateRequest(createCategoryValidationSchema),
  categoryController.CreateCategory,
);

router.get("/", categoryController.GetAllCategories);

router.get("/:id", categoryController.GetCategoryById);

router.patch(
  "/:id",
  Auth(UserRole.ADMIN),
  uploadCategoryImage,
  validateRequest(updateCategoryValidationSchema),
  categoryController.UpdateCategory,
);

export const categoryRoutes = router;
