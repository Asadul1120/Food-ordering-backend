import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const hourSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isClosed: z.boolean(),
    opensAt: timeSchema.nullable(),
    closesAt: timeSchema.nullable(),
  })
  .refine(
    ({ isClosed, opensAt, closesAt }) =>
      isClosed ||
      (opensAt !== null && closesAt !== null && opensAt !== closesAt),
    "Choose different opening and closing times for each open day",
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const phoneSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\+[1-9]\d{7,14}$/.test(value),
    "Enter the phone number with its country code, e.g. +8801712345678",
  )
  .transform((value) => value || null);

const linkSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      value === "" || z.url({ protocol: /^https$/ }).safeParse(value).success,
    "Enter a valid HTTPS link",
  )
  .transform((value) => value || null);

export const saveRestaurantSettingSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    tagline: optionalText(120),
    description: optionalText(600),
    phone: phoneSchema,
    whatsappNumber: phoneSchema,
    address: optionalText(300),
    deliveryArea: optionalText(250),
    googleMapsUrl: linkSchema,
    facebookUrl: linkSchema,
    hours: z.preprocess(
      (value) => {
        if (typeof value !== "string") return value;

        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      },
      z
        .array(hourSchema)
        .length(7)
        .refine(
          (hours) => new Set(hours.map((hour) => hour.dayOfWeek)).size === 7,
          "Provide the hours for all seven days",
        ),
    ),
  })
  .strict();
