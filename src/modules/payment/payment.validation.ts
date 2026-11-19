import { z } from "zod";
import { PaymentStatus } from "../../generated/prisma/enums.ts";

export const verifyPaymentValidationSchema = z
  .object({
    paymentID: z.string().trim().min(1, "Payment ID is required").max(200),

    status: z.enum(["success", "failure", "cancel"]),
  })
  .strict();

export const paymentQueryValidationSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().max(100).optional(),

    paymentMethod: z.enum(["BKASH", "CASH_ON_DELIVERY"]).optional(),

    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  })
  .strict();

export const updatePaymentStatusValidationSchema = z
  .object({
    paymentStatus: z.nativeEnum(PaymentStatus),
  })
  .strict();
