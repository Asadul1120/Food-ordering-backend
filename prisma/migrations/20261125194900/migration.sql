-- CreateTable
CREATE TABLE "restaurant_hours" (
    "restaurantSettingId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "opensAt" VARCHAR(5),
    "closesAt" VARCHAR(5),
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "restaurant_hours_pkey" PRIMARY KEY ("restaurantSettingId","dayOfWeek")
);

-- CreateTable
CREATE TABLE "restaurant_settings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "phone" TEXT,
    "whatsappNumber" TEXT,
    "address" TEXT,
    "deliveryArea" TEXT,
    "googleMapsUrl" TEXT,
    "facebookUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "restaurant_hours" ADD CONSTRAINT "restaurant_hours_restaurantSettingId_fkey" FOREIGN KEY ("restaurantSettingId") REFERENCES "restaurant_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
