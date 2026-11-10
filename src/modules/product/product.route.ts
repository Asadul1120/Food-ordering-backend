import { Router } from "express";
import { productController } from "./product.controller.ts";
import Auth from "../../middleware/Auth.ts";
import { UserRole } from "../../generated/prisma/enums.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { createProductValidationSchema } from "./product.validation.ts";
import { uploadProductImage } from "../../middleware/upload.ts";

const router = Router();

router.post(
  "/",
  Auth(UserRole.ADMIN),
  uploadProductImage,
  validateRequest(createProductValidationSchema),
  productController.CreateProduct,
);

router.get("/", productController.GetAllProducts);

export const productRoutes = router;
