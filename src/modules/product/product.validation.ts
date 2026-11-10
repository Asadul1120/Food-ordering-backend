import { z } from "zod";

export const createProductValidationSchema = z
  .object({
    categoryId: z.string().min(1, "Category ID is required"),

    name: z
      .string()
      .trim()
      .min(2, "Product name must be at least 2 characters")
      .max(100, "Product name cannot exceed 100 characters"),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid product slug")
      .optional(),

    description: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z
        .string()
        .trim()
        .max(1000, "Description cannot exceed 1000 characters")
        .optional(),
    ),

    price: z.preprocess(
      (value) =>
        value === undefined || value === null ? "" : String(value).trim(),
      z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, "Price must have up to 2 decimal places")
        .refine((value) => Number(value) > 0, "Price must be greater than 0"),
    ),

    preparationTime: z.preprocess(
      (value) =>
        value === "" || value === undefined ? undefined : Number(value),
      z
        .number()
        .int("Preparation time must be an integer")
        .positive("Preparation time must be greater than 0")
        .optional(),
    ),
  })
  .strict();
