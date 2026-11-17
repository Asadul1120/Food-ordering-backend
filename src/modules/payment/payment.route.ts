import { Router } from "express";
import { paymentController } from "./payment.controller.ts";
import { OptionalAuth } from "../../middleware/OptionalAuth.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { verifyPaymentValidationSchema } from "./payment.validation.ts";

const router = Router();

router.post(
  "/initiate/:orderId",
  OptionalAuth,
  paymentController.InitiatePayment,
);

router.post(
  "/verify",
  OptionalAuth,
  validateRequest(verifyPaymentValidationSchema),
  paymentController.VerifyPayment,
);

export const paymentRoutes = router;
