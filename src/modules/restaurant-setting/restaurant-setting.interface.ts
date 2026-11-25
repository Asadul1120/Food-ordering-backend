import type { z } from "zod";
import type { saveRestaurantSettingSchema } from "./restaurant-setting.validation.ts";

export type ISaveRestaurantSettingInput = z.infer<typeof saveRestaurantSettingSchema>;