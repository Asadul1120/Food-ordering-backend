import type { RequestHandler } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { AppError } from "../../utils/AppError.ts";
import { couponService } from "./coupon.service.ts";
import { couponQueryValidationSchema } from "./coupon.validation.ts";

const CreateCoupon: RequestHandler = catchAsync(async (req, res) => {
  const coupon = await couponService.CreateCoupon(req.body);

  apiResponse(res, {
    statusCode: 201,
    success: true,
    message: "Coupon created",
    data: coupon,
  });
});

const GetAllCoupons: RequestHandler = catchAsync(async (req, res) => {
  const result = couponQueryValidationSchema.safeParse(req.query);

  if (!result.success) {
    throw new AppError(
      400,
      result.error.issues[0]?.message ?? "Invalid coupon query",
    );
  }

  const coupons = await couponService.GetAllCoupons(result.data);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Coupons retrieved",
    data: coupons,
  });
});

const GetCouponById: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;
  const coupon = await couponService.GetCouponById(id as string);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Coupon retrieved",
    data: coupon,
  });
});

const UpdateCoupon: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;
  const coupon = await couponService.UpdateCoupon(id as string, req.body);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Coupon updated",
    data: coupon,
  });
});

const UpdateCouponStatus: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const coupon = await couponService.UpdateCouponStatus(id as string, isActive);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Coupon status updated",
    data: coupon,
  });
});

const DeleteCoupon: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;
  const coupon = await couponService.DeleteCoupon(id as string);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Coupon deleted",
    data: coupon,
  });
});

const ValidateCoupon: RequestHandler = catchAsync(async (req, res) => {
  const coupon = await couponService.ValidateCoupon(req.body, req.user?.id);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Coupon is valid",
    data: coupon,
  });
});

export const couponController = {
  CreateCoupon,
  GetAllCoupons,
  GetCouponById,
  UpdateCoupon,
  UpdateCouponStatus,
  DeleteCoupon,
  ValidateCoupon,
};