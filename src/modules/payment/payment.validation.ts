import { z } from "zod";

export const verifyPaymentValidationSchema = z
  .object({
    paymentID: z
      .string()
      .trim()
      .min(1, "Payment ID is required"),
  })
  .strict();