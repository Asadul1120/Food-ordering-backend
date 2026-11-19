import type { RequestHandler } from "express";

import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { AppError } from "../../utils/AppError.ts";

import { paymentService } from "./payment.service.ts";

import { paymentQueryValidationSchema } from "./payment.validation.ts";

// Initiate Payment
const InitiatePayment: RequestHandler = catchAsync(async (req, res) => {
  const { orderId } = req.params;

  const result = await paymentService.InitiatePayment(orderId as string, {
    userId: req.user?.id,
    userRole: req.user?.role,
    guestToken: req.get("x-guest-token"),
  });

  const message = result.requiresOnlinePayment
    ? "bKash payment initiated successfully"
    : "Cash on delivery selected";

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message,
    data: result,
  });
});

// Verify Payment
const VerifyPayment: RequestHandler = catchAsync(async (req, res) => {
  const payment = await paymentService.VerifyPayment(req.body);

  const message =
    payment.paymentStatus === "PAID"
      ? "Payment verified successfully"
      : "Payment is not completed";

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message,
    data: payment,
  });
});

// Get payment details by order ID
const GetOrderPayment: RequestHandler = catchAsync(async (req, res) => {
  const { orderId } = req.params;

  const payment = await paymentService.GetOrderPayment(orderId as string, {
    userId: req.user?.id,
    userRole: req.user?.role,
    guestToken: req.get("x-guest-token"),
  });

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order payments retrieved successfully",
    data: payment,
  });
});

// Get all payments
const GetAllPayments: RequestHandler = catchAsync(async (req, res) => {
  const result = paymentQueryValidationSchema.safeParse(req.query);

  if (!result.success) {
    throw new AppError(
      400,
      result.error.issues[0]?.message ?? "Invalid query parameters",
    );
  }

  const payments = await paymentService.GetAllPayments(result.data);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payments retrieved successfully",
    data: payments,
  });
});

// Update payment status
const UpdatePaymentStatus: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const payment = await paymentService.UpdatePaymentStatus(
    id as string,
    req.body,
  );

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payment status updated successfully",
    data: payment,
  });
});

export const paymentController = {
  InitiatePayment,
  VerifyPayment,
  GetOrderPayment,
  GetAllPayments,
  UpdatePaymentStatus,
};
