import { z } from "zod";

import { WishlistStatus } from "../../generated/prisma/enums.ts";

// Create Wishlist Validation
export const createWishlistValidationSchema = z
  .object({
    foodName: z
      .string()
      .trim()
      .min(2, "Food name must be at least 2 characters")
      .max(100, "Food name cannot exceed 100 characters"),

    foodDescription: z
      .string()
      .trim()
      .min(5, "Food description must be at least 5 characters")
      .max(1000, "Description cannot exceed 1000 characters"),

    expectedTime: z
      .string()
      .datetime({
        offset: true,
        message: "Invalid expected date and time",
      })
      .refine((value) => new Date(value) > new Date(), {
        message: "Expected time must be in the future",
      }),

    customerName: z
      .string()
      .trim()
      .min(2, "Customer name is required")
      .max(80)
      .optional(),

    customerPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, "Invalid phone number")
      .optional(),

    customerEmail: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(254)
      .optional(),
    customerAddress: z
      .string()
      .trim()
      .min(8, "Please enter a valid address")
      .max(700, "Address is too long")
      .optional(),
  })
  .strict();

// Wishlist Query Validation
export const wishlistQueryValidationSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().optional(),

    status: z.nativeEnum(WishlistStatus).optional(),
  })
  .strict();

// Update Wishlist Status Validation
export const updateWishlistStatusValidationSchema = z
  .object({
    status: z.nativeEnum(WishlistStatus),

    adminNote: z
      .string()
      .trim()
      .max(500, "Admin note cannot exceed 500 characters")
      .optional(),
  })
  .strict();
