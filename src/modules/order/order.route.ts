import { Router } from "express";
import { orderController } from "./order.controller.ts";
import { OptionalAuth } from "../../middleware/OptionalAuth.ts";
import { createOrderValidationSchema } from "./order.validation.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";

const router = Router();

router.post(
  "/",
  OptionalAuth,
  validateRequest(createOrderValidationSchema),
  orderController.CreateOrder,
);

export const orderRoutes = router;
