import { NextFunction, Request, Response } from "express";
import z from "zod";
import { catchAsync } from "../utils/catchAsync.ts";
import { AppError } from "../utils/AppError.ts";

export const validateRequest = (zodSchema: z.ZodObject) => {
  return catchAsync((req: Request, res: Response, next: NextFunction) => {
    const payload = req.body ? req.body : {};

    const result = zodSchema.safeParse(payload);

    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? "Invalid request data");
    }

    req.body = result.data;

    next();
  });
};
