import { Router } from "express";

import { paymentController } from "./payment.controller.ts";

import Auth from "../../middleware/Auth.ts";
import { OptionalAuth } from "../../middleware/OptionalAuth.ts";

import { validateRequest } from "../../middleware/validateRequest.ts";

import { UserRole } from "../../generated/prisma/enums.ts";

import {
  verifyPaymentValidationSchema,
  updatePaymentStatusValidationSchema,
} from "./payment.validation.ts";

const router = Router();

// Initiate Payment
router.post(
  "/initiate/:orderId",
  OptionalAuth,
  paymentController.InitiatePayment,
);

// Public payment verification
router.post(
  "/verify",
  validateRequest(verifyPaymentValidationSchema),
  paymentController.VerifyPayment,
);

// Get payment details by order ID
router.get("/order/:orderId", OptionalAuth, paymentController.GetOrderPayment);

// Get all payments
router.get("/", Auth(UserRole.ADMIN), paymentController.GetAllPayments);

// Update payment status
router.patch(
  "/:id/status",
  Auth(UserRole.ADMIN),
  validateRequest(updatePaymentStatusValidationSchema),
  paymentController.UpdatePaymentStatus,
);

export const paymentRoutes = router;
