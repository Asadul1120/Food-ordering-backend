import { z } from "zod";

export const createCategoryValidationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must be at least 2 characters")
      .max(80, "Category name cannot exceed 80 characters"),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid category slug")
      .optional(),

    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters")
      .optional(),
  })
  .strict();

export const updateCategoryValidationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must be at least 2 characters")
      .max(80, "Category name cannot exceed 80 characters")
      .optional(),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid category slug")
      .optional(),

    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters")
      .nullable()
      .optional(),
  })
  .strict();
