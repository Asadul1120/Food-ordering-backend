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
