import type { RequestHandler } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { orderService } from "./order.service.ts";

const CreateOrder: RequestHandler = catchAsync(async (req, res) => {
  const order = await orderService.CreateOrder(req.body, req.user?.id);

  apiResponse(res, {
    statusCode: 201,
    success: true,
    message: "Order placed successfully",
    data: order,
  });
});

export const orderController = {
  CreateOrder,
};
