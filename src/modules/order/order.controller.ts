
import type { RequestHandler } from "express";

import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { orderService } from "./order.service.ts";

import {
  myOrdersQueryValidationSchema,
  orderQueryValidationSchema,
} from "./order.validation.ts";

import { AppError } from "../../utils/AppError.ts";

import { PaymentMethod } from "../../generated/prisma/enums.ts";

// Create Order
const CreateOrder: RequestHandler = catchAsync(async (req, res) => {
  const order = await orderService.CreateOrder(req.body, req.user?.id);

  const isBkash = order.payments?.[0]?.paymentMethod === PaymentMethod.BKASH;

  apiResponse(res, {
    statusCode: 201,
    success: true,

    message: isBkash
      ? "Order created. Please complete bKash payment"
      : "Order placed successfully",

    data: order,
  });
});

// Get All Orders
const GetAllOrders: RequestHandler = catchAsync(async (req, res) => {
  const result = orderQueryValidationSchema.safeParse(req.query);

  if (!result.success) {
    throw new AppError(
      400,
      result.error.issues[0]?.message ?? "Invalid query parameters",
    );
  }

  const orders = await orderService.GetAllOrders(result.data);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Orders retrieved successfully",
    data: orders,
  });
});

// Get Order By ID
const GetOrderById: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const order = await orderService.GetOrderById(id as string);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order retrieved successfully",
    data: order,
  });
});

// Get My Orders
const GetMyOrders: RequestHandler = catchAsync(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(401, "Please login first");
  }

  const result = myOrdersQueryValidationSchema.safeParse(req.query);

  if (!result.success) {
    throw new AppError(
      400,
      result.error.issues[0]?.message ?? "Invalid query parameters",
    );
  }

  const orders = await orderService.GetMyOrders(userId, result.data);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Your orders retrieved successfully",
    data: orders,
  });
});

// Get Order Tracking

// Get Order Tracking
const GetOrderTracking: RequestHandler = catchAsync(async (req, res) => {
  const { orderNumber } = req.params;
  const phone = req.query.phone;

  // Mobile number is required for guest verification
  if (typeof phone !== "string" || !phone.trim()) {
    throw new AppError(400, "Mobile number is required");
  }

  const order = await orderService.GetOrderTracking(
    orderNumber as string,
    phone.trim(),
  );

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order tracking information retrieved successfully",
    data: order,
  });
});

// Update Order Status
const UpdateOrderStatus: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const order = await orderService.UpdateOrderStatus(  id as string,
  req.body,
  req.user?.role,);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order status updated successfully",
    data: order,
  });
});

// Cancel Order
const CancelOrder: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    throw new AppError(401, "Please login first");
  }

  const order = await orderService.CancelOrder(id as string, userId, userRole);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order cancelled successfully",
    data: order,
  });
});

export const orderController = {
  CreateOrder,
  GetAllOrders,
  GetOrderById,
  GetMyOrders,
  GetOrderTracking,
  UpdateOrderStatus,
  CancelOrder,
};
