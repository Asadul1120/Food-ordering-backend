import { z } from "zod";

export const registerValidationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name cannot exceed 80 characters"),

  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Invalid phone number")
    .optional(),

  email: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().email("Invalid email address"),
  ),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password cannot exceed 72 characters"),
});

export const loginValidationSchema = z.object({
  email: z.string().trim().min(8, "Phone number is required"),
  password: z.string().min(1, "Password is required"),
});
