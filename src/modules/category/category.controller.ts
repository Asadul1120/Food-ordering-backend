import type { RequestHandler } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { categoryService } from "./category.service.ts";

const CreateCategory: RequestHandler = catchAsync(async (req, res) => {
  const category = await categoryService.CreateCategory(req.body, req.file);

  apiResponse(res, {
    statusCode: 201,
    success: true,
    message: "Category created successfully",
    data: category,
  });
});

const GetAllCategories: RequestHandler = catchAsync(async (_req, res) => {
  const categories = await categoryService.GetAllCategories();

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Categories retrieved successfully",
    data: categories,
  });
});

const GetCategoryById: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const category = await categoryService.GetCategoryById(id as string);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category retrieved successfully",
    data: category,
  });
});

const UpdateCategory: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const category = await categoryService.UpdateCategory(id as string, req.body, req.file);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category updated successfully",
    data: category,
  });
});

export const categoryController = {
  CreateCategory,
  GetAllCategories,
  GetCategoryById,
  UpdateCategory,
};
