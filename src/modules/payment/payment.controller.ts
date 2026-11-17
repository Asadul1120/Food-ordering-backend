import type { RequestHandler } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { paymentService } from "./payment.service.ts";

const InitiatePayment: RequestHandler = catchAsync(async (req, res) => {
  const { orderId } = req.params;

  const result = await paymentService.InitiatePayment(
    orderId as string,
    req.user?.id,
  );

  const message =
    result.paymentMethod === "CASH_ON_DELIVERY"
      ? "Cash on delivery selected"
      : "bKash payment initiated successfully";

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message,
    data: result,
  });
});

const VerifyPayment: RequestHandler = catchAsync(async (req, res) => {
  const payment = await paymentService.VerifyPayment(req.body, req.user?.id);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payment verified successfully",
    data: payment,
  });
});

export const paymentController = {
  InitiatePayment,
  VerifyPayment,
};
