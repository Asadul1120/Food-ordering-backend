import { Router } from "express";
import { paymentController } from "./payment.controller.ts";
import { OptionalAuth } from "../../middleware/OptionalAuth.ts";

const router = Router();

router.post(
  "/initiate/:orderId",
  OptionalAuth,
  paymentController.InitiatePayment,
);

export const paymentRoutes = router;
