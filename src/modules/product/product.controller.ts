import type { RequestHandler } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { productService } from "./product.service.ts";
import { AppError } from "../../utils/AppError.ts";
import {
  productCategoryQueryValidationSchema,
  productQueryValidationSchema,
} from "./product.validation.ts";

const CreateProduct: RequestHandler = catchAsync(async (req, res) => {
  const product = await productService.CreateProduct(req.body, req.file);

  apiResponse(res, {
    statusCode: 201,
    success: true,
    message: "Product created successfully",
    data: product,
  });
});

const GetAllProducts: RequestHandler = catchAsync(async (req, res) => {
  const result = productQueryValidationSchema.safeParse(req.query);

  if (!result.success) {
    throw new AppError(
      400,
      result.error.issues[0]?.message ?? "Invalid query parameters",
    );
  }

  const products = await productService.GetAllProducts(result.data);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Products retrieved successfully",
    data: products,
  });
});

const GetProductById: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const product = await productService.GetProductById(id as string);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product retrieved successfully",
    data: product,
  });
});

const GetFeaturedProducts: RequestHandler = catchAsync(async (_req, res) => {
  const products = await productService.GetFeaturedProducts();

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Featured products retrieved successfully",
    data: products,
  });
});

const GetProductsByCategory: RequestHandler = catchAsync(async (req, res) => {
  const { categoryId } = req.params;

  const result = productCategoryQueryValidationSchema.safeParse(req.query);

  if (!result.success) {
    throw new AppError(
      400,
      result.error.issues[0]?.message ?? "Invalid query parameters",
    );
  }

  const products = await productService.GetProductsByCategory(
    categoryId as string,
    result.data,
  );

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category products retrieved successfully",
    data: products,
  });
});

const UpdateProduct: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const product = await productService.UpdateProduct(
    id as string,
    req.body,
    req.file,
  );

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product updated successfully",
    data: product,
  });
});

export const productController = {
  CreateProduct,
  GetAllProducts,
  GetProductById,
  GetFeaturedProducts,
  GetProductsByCategory,
  UpdateProduct,
};
