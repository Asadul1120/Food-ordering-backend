import { Router } from "express";
import { UserRole } from "../../generated/prisma/enums.ts";
import Auth from "../../middleware/Auth.ts";
import { uploadCategoryImage } from "../../middleware/upload.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { restaurantSettingController } from "./restaurant-setting.controller.ts";
import { saveRestaurantSettingSchema } from "./restaurant-setting.validation.ts";

const router = Router();

router.get("/", restaurantSettingController.GetRestaurantSetting);

router.put(
  "/",
  Auth(UserRole.ADMIN),
  uploadCategoryImage,
  validateRequest(saveRestaurantSettingSchema),
  restaurantSettingController.SaveRestaurantSetting,
);

export const restaurantSettingRoutes = router;
