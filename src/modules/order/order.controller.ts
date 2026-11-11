import type { RequestHandler } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { orderService } from "./order.service.ts";
import {
  myOrdersQueryValidationSchema,
  orderQueryValidationSchema,
} from "./order.validation.ts";
import { AppError } from "../../utils/AppError.ts";

const CreateOrder: RequestHandler = catchAsync(async (req, res) => {
  const order = await orderService.CreateOrder(req.body, req.user?.id);

  apiResponse(res, {
    statusCode: 201,
    success: true,
    message: "Order placed successfully",
    data: order,
  });
});

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

export const orderController = {
  CreateOrder,
  GetAllOrders,
  GetOrderById,
  GetMyOrders,
};
