import type { RequestHandler } from "express";

import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { AppError } from "../../utils/AppError.ts";

import { wishlistService } from "./wishlist.service.ts";

import { wishlistQueryValidationSchema } from "./wishlist.validation.ts";

// 1. Create Wishlist
const CreateWishlist: RequestHandler = catchAsync(async (req, res) => {
  const wishlist = await wishlistService.CreateWishlist(req.body, req.user?.id);

  apiResponse(res, {
    statusCode: 201,
    success: true,
    message: "Wishlist submitted successfully",
    data: wishlist,
  });
});

// 2. Get All Wishlists
const GetAllWishlists: RequestHandler = catchAsync(async (req, res) => {
  const result = wishlistQueryValidationSchema.safeParse(req.query);

  if (!result.success) {
    throw new AppError(
      400,
      result.error.issues[0]?.message ?? "Invalid query parameters",
    );
  }

  const wishlists = await wishlistService.GetAllWishlists(result.data);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Wishlists retrieved successfully",
    data: wishlists,
  });
});

// 3. Get Wishlist By ID
const GetWishlistById: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const wishlist = await wishlistService.GetWishlistById(id as string);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Wishlist retrieved successfully",
    data: wishlist,
  });
});

// 4. Update Wishlist Status
const UpdateWishlistStatus: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const wishlist = await wishlistService.UpdateWishlistStatus(
    id as string,
    req.body,
  );

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Wishlist status updated successfully",
    data: wishlist,
  });
});

// Delete wishlist
const DeleteWishlist: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const wishlist = await wishlistService.DeleteWishlist(id as string);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Wishlist deleted successfully",
    data: wishlist,
  });
});

export const wishlistController = {
  CreateWishlist,
  GetAllWishlists,
  GetWishlistById,
  UpdateWishlistStatus,
  DeleteWishlist,
};
