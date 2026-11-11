import { Router } from "express";
import { productController } from "./product.controller.ts";
import Auth from "../../middleware/Auth.ts";
import { UserRole } from "../../generated/prisma/enums.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import {
  createProductValidationSchema,
  updateProductAvailabilityValidationSchema,
  updateProductValidationSchema,
} from "./product.validation.ts";
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

router.get("/featured", productController.GetFeaturedProducts);

router.get("/category/:categoryId", productController.GetProductsByCategory);

router.patch(
  "/:id",
  Auth(UserRole.ADMIN),
  uploadProductImage,
  validateRequest(updateProductValidationSchema),
  productController.UpdateProduct,
);

router.get("/:id", productController.GetProductById);

router.patch(
  "/:id/availability",
  Auth(UserRole.ADMIN, UserRole.STAFF),
  validateRequest(updateProductAvailabilityValidationSchema),
  productController.UpdateProductAvailability,
);

export const productRoutes = router;
