import { Router } from "express";
import { orderController } from "./order.controller.ts";
import { OptionalAuth } from "../../middleware/OptionalAuth.ts";
import {
  createOrderValidationSchema,
  updateOrderStatusValidationSchema,
} from "./order.validation.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { UserRole } from "../../generated/prisma/enums.ts";
import Auth from "../../middleware/Auth.ts";

const router = Router();

router.post(
  "/",
  OptionalAuth,
  validateRequest(createOrderValidationSchema),
  orderController.CreateOrder,
);

router.get(
  "/",
  Auth(UserRole.ADMIN, UserRole.STAFF),
  orderController.GetAllOrders,
);

router.get("/my-orders", Auth(UserRole.CUSTOMER), orderController.GetMyOrders);
router.get("/track/:orderNumber", orderController.GetOrderTracking);

router.patch(
  "/:id/status",
  Auth(UserRole.ADMIN, UserRole.STAFF),
  validateRequest(updateOrderStatusValidationSchema),
  orderController.UpdateOrderStatus,
);
router.patch(
  "/:id/cancel",
  Auth(UserRole.ADMIN, UserRole.CUSTOMER),
  orderController.CancelOrder,
);

router.get(
  "/:id",
  Auth(UserRole.ADMIN, UserRole.STAFF),
  orderController.GetOrderById,
);

export const orderRoutes = router;
