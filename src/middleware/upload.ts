import multer from "multer";
import type { Request, Response, NextFunction } from "express";

import { AppError } from "../utils/AppError.ts";

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new AppError(400, "Only image files are allowed"));
    }

    callback(null, true);
  },
});

export const uploadCategoryImage = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload.single("image")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      return next(new AppError(400, error.message));
    }

    if (error) {
      return next(error);
    }

    next();
  });
};

export const uploadProductImage = uploadCategoryImage;
