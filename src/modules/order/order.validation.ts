import { z } from "zod";

export const createOrderValidationSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(2, "Customer name must be at least 2 characters")
      .max(80, "Customer name cannot exceed 80 characters"),

    customerPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, "Invalid phone number"),

    deliveryAddress: z
      .string()
      .trim()
      .min(8, "Delivery address must be at least 8 characters")
      .max(500, "Delivery address cannot exceed 500 characters"),

    orderNote: z
      .string()
      .trim()
      .max(500, "Order note cannot exceed 500 characters")
      .optional(),

    couponCode: z.preprocess(
      (value) =>
        typeof value === "string"
          ? value.trim().toUpperCase() || undefined
          : value,
      z.string().max(50).optional(),
    ),

    paymentMethod: z.enum([
      "CASH_ON_DELIVERY",
      "BKASH",
      "STRIPE",
      "SSLCOMMERZ",
    ]),

    items: z
      .array(
        z
          .object({
            productId: z.string().min(1, "Product ID is required"),

            quantity: z
              .number()
              .int("Quantity must be an integer")
              .min(1, "Quantity must be at least 1")
              .max(99, "Maximum quantity is 99"),
          })
          .strict(),
      )
      .min(1, "At least one product is required")
      .max(50, "Maximum 50 order items are allowed"),
  })
  .strict();
