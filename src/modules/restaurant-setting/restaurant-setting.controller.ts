import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { restaurantSettingService } from "./restaurant-setting.service.ts";

const GetRestaurantSetting = catchAsync(async (_req, res) => {
  const setting = await restaurantSettingService.GetRestaurantSetting();

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Restaurant settings retrieved successfully",
    data: setting,
  });
});

const SaveRestaurantSetting = catchAsync(async (req, res) => {
  const setting = await restaurantSettingService.SaveRestaurantSetting(
    req.body,
    req.file,
  );

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Restaurant settings saved successfully",
    data: setting,
  });
});

export const restaurantSettingController = {
  GetRestaurantSetting,
  SaveRestaurantSetting,
};
