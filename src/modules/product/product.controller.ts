import type { RequestHandler } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { productService } from "./product.service.ts";
import { AppError } from "../../utils/AppError.ts";
import { productQueryValidationSchema } from "./product.validation.ts";

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

export const productController = {
  CreateProduct,
  GetAllProducts,
};
