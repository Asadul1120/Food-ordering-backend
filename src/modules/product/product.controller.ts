import type { RequestHandler } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { productService } from "./product.service.ts";

const CreateProduct: RequestHandler = catchAsync(async (req, res) => {
  const product = await productService.CreateProduct(req.body, req.file);

  apiResponse(res, {
    statusCode: 201,
    success: true,
    message: "Product created successfully",
    data: product,
  });
});

export const productController = {
  CreateProduct,
};
