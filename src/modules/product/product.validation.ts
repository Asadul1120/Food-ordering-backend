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

export const productQueryValidationSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().optional(),

    categoryId: z.string().optional(),

    minPrice: z.coerce.number().nonnegative().optional(),

    maxPrice: z.coerce.number().nonnegative().optional(),

    sortBy: z.enum(["createdAt", "price", "name"]).default("createdAt"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.minPrice <= data.maxPrice,
    {
      message: "Minimum price cannot be greater than maximum price",
      path: ["maxPrice"],
    },
  );

const productQueryFieldsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional(),

  categoryId: z.string().optional(),

  minPrice: z.coerce.number().nonnegative().optional(),

  maxPrice: z.coerce.number().nonnegative().optional(),

  sortBy: z.enum(["createdAt", "price", "name"]).default("createdAt"),

  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Get All Products Validation
// export const productQueryValidationSchema = productQueryFieldsSchema
//   .strict()
//   .refine(
//     (data) =>
//       data.minPrice === undefined ||
//       data.maxPrice === undefined ||
//       data.minPrice <= data.maxPrice,
//     {
//       message: "Minimum price cannot be greater than maximum price",
//       path: ["maxPrice"],
//     },
//   );

// Get Products By Category Validation
export const productCategoryQueryValidationSchema = productQueryFieldsSchema
  .omit({
    categoryId: true,
  })
  .strict()
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.minPrice <= data.maxPrice,
    {
      message: "Minimum price cannot be greater than maximum price",
      path: ["maxPrice"],
    },
  );

export const updateProductValidationSchema = z
  .object({
    categoryId: z.string().min(1, "Category ID is required").optional(),

    name: z
      .string()
      .trim()
      .min(2, "Product name must be at least 2 characters")
      .max(100, "Product name cannot exceed 100 characters")
      .optional(),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid product slug")
      .optional(),

    description: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().trim().max(1000).nullable().optional(),
    ),

    price: z.preprocess(
      (value) =>
        value === undefined || value === null ? value : String(value).trim(),
      z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, "Price must have up to 2 decimal places")
        .refine((value) => Number(value) > 0, "Price must be greater than 0")
        .optional(),
    ),

    preparationTime: z.preprocess(
      (value) =>
        value === "" || value === undefined
          ? undefined
          : value === null
            ? null
            : Number(value),
      z
        .number()
        .int("Preparation time must be an integer")
        .positive("Preparation time must be greater than 0")
        .nullable()
        .optional(),
    ),
  })
  .strict();

export const updateProductAvailabilityValidationSchema = z
  .object({
    isAvailable: z.boolean(),
  })
  .strict();


  export const updateProductFeaturedValidationSchema = z
  .object({
    isFeatured: z.boolean(),
  })
  .strict();