import type { RequestHandler } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { categoryService } from "./category.service.ts";


const GetAllCategories: RequestHandler = catchAsync(async (_req, res) => {
  const categories = await categoryService.GetAllCategories();

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Categories retrieved successfully",
    data: categories,
  });
});

export const categoryController = {
  GetAllCategories,
};
