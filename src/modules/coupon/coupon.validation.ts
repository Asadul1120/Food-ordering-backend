import { z } from "zod";
import { DiscountType } from "../../generated/prisma/enums.ts";
import { createOrderValidationSchema } from "../order/order.validation.ts";

const code = z.string().trim().min(1).max(50).toUpperCase();

const amount = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Invalid amount"));

const usageLimit = z.number().int().min(1).max(2147483647);

const date = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const couponFields = z
  .object({
    code,
    description: z.string().trim().max(1000).nullable().optional(),

    discountType: z.enum(DiscountType),
    discountValue: amount,
    minOrderAmount: amount.optional(),
    maxDiscountAmount: amount.nullable().optional(),

    usageLimit: usageLimit.nullable().optional(),
    perUserLimit: usageLimit.nullable().optional(),

    startDate: date,
    expiryDate: date,
  })
  .strict();

export const createCouponValidationSchema = couponFields.extend({
  discountValue: amount.default("0"),
  isActive: z.boolean().optional(),
});

export const updateCouponValidationSchema = couponFields
  .partial()
  .refine(
    (payload) => Object.keys(payload).length > 0,
    "Provide at least one field to update",
  );

export const updateCouponStatusValidationSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const validateCouponValidationSchema = z
  .object({
    code,
    items: createOrderValidationSchema.shape.items,
  })
  .strict();

export const couponQueryValidationSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).optional(),
    discountType: z.enum(DiscountType).optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();
