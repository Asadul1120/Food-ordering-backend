import type { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../utils/cloudinary.ts";
import type { ISaveRestaurantSettingInput } from "./restaurant-setting.interface.ts";

const settingId = "default";
const logoTypes = ["image/png", "image/jpeg", "image/webp"];

const publicSelect = {
  name: true,
  tagline: true,
  description: true,
  logoUrl: true,
  phone: true,
  whatsappNumber: true,
  address: true,
  deliveryArea: true,
  googleMapsUrl: true,
  facebookUrl: true,
  timezone: true,
  hours: {
    orderBy: { dayOfWeek: "asc" },
    select: { dayOfWeek: true, opensAt: true, closesAt: true, isClosed: true },
  },
} satisfies Prisma.RestaurantSettingSelect;

const GetRestaurantSetting = () =>
  prisma.restaurantSetting.findUnique({
    where: { id: settingId },
    select: publicSelect,
  });

const cleanupLogo = async (publicId: string) => {
  await deleteFromCloudinary(publicId).catch((error) => {
    console.error("Could not clean up restaurant logo:", error);
  });
};

const SaveRestaurantSetting = async (
  payload: ISaveRestaurantSettingInput,
  file?: Express.Multer.File,
) => {
  if (file && !logoTypes.includes(file.mimetype)) {
    throw new AppError(400, "Use a PNG, JPG or WebP logo");
  }

  const { hours, ...details } = payload;

  const logo = file
    ? await uploadToCloudinary(file, "food-ordering/restaurant").catch(() => {
        throw new AppError(502, "Could not upload the restaurant logo");
      })
    : undefined;

  const { setting, previousLogo } = await prisma
    .$transaction(async (tx) => {
      // Lock the settings row before replacing its weekly schedule.
      const previous = await tx.restaurantSetting.upsert({
        where: { id: settingId },
        create: { id: settingId, ...details },
        update: details,
        select: { logoPublicId: true },
      });

      if (logo) {
        await tx.restaurantSetting.update({
          where: { id: settingId },
          data: { logoUrl: logo.secure_url, logoPublicId: logo.public_id },
        });
      }

      await tx.restaurantHour.deleteMany({
        where: { restaurantSettingId: settingId },
      });

      await tx.restaurantHour.createMany({
        data: hours.map((hour) => ({
          ...hour,
          restaurantSettingId: settingId,
          opensAt: hour.isClosed ? null : hour.opensAt,
          closesAt: hour.isClosed ? null : hour.closesAt,
        })),
      });

      const setting = await tx.restaurantSetting.findUniqueOrThrow({
        where: { id: settingId },
        select: publicSelect,
      });

      return { setting, previousLogo: previous.logoPublicId };
    })
    .catch(async (error) => {
      if (logo) await cleanupLogo(logo.public_id);
      throw error;
    });

  if (logo && previousLogo && previousLogo !== logo.public_id) {
    await cleanupLogo(previousLogo);
  }

  return setting;
};

export const restaurantSettingService = {
  GetRestaurantSetting,
  SaveRestaurantSetting,
};
