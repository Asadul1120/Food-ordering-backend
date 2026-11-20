import { Router } from "express";
import { UserRole } from "../../generated/prisma/enums.ts";
import Auth from "../../middleware/Auth.ts";
import { OptionalAuth } from "../../middleware/OptionalAuth.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { couponController } from "./coupon.controller.ts";

import {
  createCouponValidationSchema,
  updateCouponValidationSchema,
  updateCouponStatusValidationSchema,
  validateCouponValidationSchema,
} from "./coupon.validation.ts";

const router = Router();

// Public
router.post(
  "/validate",
  OptionalAuth,
  validateRequest(validateCouponValidationSchema),
  couponController.ValidateCoupon,
);

// Admin
router.get("/", Auth(UserRole.ADMIN), couponController.GetAllCoupons);

router.get("/:id", Auth(UserRole.ADMIN), couponController.GetCouponById);

router.post(
  "/",
  Auth(UserRole.ADMIN),
  validateRequest(createCouponValidationSchema),
  couponController.CreateCoupon,
);

router.patch(
  "/:id",
  Auth(UserRole.ADMIN),
  validateRequest(updateCouponValidationSchema),
  couponController.UpdateCoupon,
);

router.patch(
  "/:id/status",
  Auth(UserRole.ADMIN),
  validateRequest(updateCouponStatusValidationSchema),
  couponController.UpdateCouponStatus,
);

router.delete("/:id", Auth(UserRole.ADMIN), couponController.DeleteCoupon);

export const couponRoutes = router;