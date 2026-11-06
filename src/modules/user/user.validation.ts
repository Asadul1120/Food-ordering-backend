import { z } from "zod";

export const userQueryValidationSchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .refine((value) => Number(value) > 0, {
      message: "Page must be greater than 0",
    }),

  limit: z
    .string()
    .optional()
    .default("10")
    .refine((value) => Number(value) > 0 && Number(value) <= 100, {
      message: "Limit must be between 1 and 100",
    }),

  search: z.string().trim().optional(),

  role: z.enum(["ADMIN", "STAFF", "CUSTOMER"]).optional(),
});


import { UserRole } from "../../generated/prisma/enums.ts";

export const updateUserValidationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name cannot exceed 80 characters")
      .optional(),

    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, "Invalid phone number")
      .optional(),

    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .nullable()
      .optional(),

    role: z.nativeEnum(UserRole).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update",
  });
