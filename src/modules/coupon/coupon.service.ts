import { Prisma } from "../../generated/prisma/client.ts";
import { DiscountType } from "../../generated/prisma/enums.ts";
import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";
import { toMoney } from "../../utils/money.ts";
import { priceCart } from "../order/order-pricing.ts";
import { evaluateCoupon } from "./coupon-pricing.ts";

import type {
  ICreateCouponInput,
  IUpdateCouponInput,
  ICouponQuery,
  IValidateCouponInput,
} from "./coupon.interface.ts";

// Admin যে মানগুলো দিচ্ছে, সেগুলো একসঙ্গে বৈধ কি না দেখে।
const checkCouponSettings = (coupon: ICreateCouponInput, usedCount = 0) => {
  const value = Number(coupon.discountValue);

  if (coupon.expiryDate <= coupon.startDate) {
    throw new AppError(400, "Expiry date must be after start date");
  }

  if (coupon.discountType === DiscountType.FREE_DELIVERY) {
    if (value !== 0) {
      throw new AppError(400, "Free delivery requires a discount value of 0");
    }
  } else if (value <= 0) {
    throw new AppError(400, "Discount value must be greater than 0");
  }

  if (coupon.discountType === DiscountType.PERCENTAGE && value > 100) {
    throw new AppError(400, "Percentage cannot exceed 100");
  }

  if (coupon.maxDiscountAmount != null) {
    if (
      coupon.discountType !== DiscountType.PERCENTAGE ||
      Number(coupon.maxDiscountAmount) <= 0
    ) {
      throw new AppError(
        400,
        "A positive discount cap is allowed only for percentage coupons",
      );
    }
  }

  if (coupon.usageLimit != null && coupon.usageLimit < usedCount) {
    throw new AppError(400, "Usage limit is below the number of uses");
  }
};

// Prisma-এর duplicate বা missing record error-এর জন্য API response।
const handleCouponError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError(409, "Coupon code already exists");
    }

    if (error.code === "P2025") {
      throw new AppError(404, "Coupon not found");
    }
  }

  throw error;
};

// একই coupon checkout-এ ব্যবহার হলে update/delete তার জন্য অপেক্ষা করে।
const lockCouponById = async (tx: Prisma.TransactionClient, id: string) => {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM coupons WHERE id = ${id} FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new AppError(404, "Coupon not found");
  }
};

// 1. Create coupon
const CreateCoupon = async (payload: ICreateCouponInput) => {
  checkCouponSettings(payload);

  return prisma.coupon
    .create({ data: payload })
    .catch(handleCouponError);
};

// 2. Get all coupons
const GetAllCoupons = async (query: ICouponQuery) => {
  const { page, limit, search, isActive, discountType } = query;

  const where: Prisma.CouponWhereInput = { isActive, discountType };

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [coupons, totalCoupons] = await prisma.$transaction([
    prisma.coupon.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.coupon.count({ where }),
  ]);

  return {
    coupons,
    pagination: {
      totalCoupons,
      currentPage: page,
      totalPages: Math.ceil(totalCoupons / limit),
      limit,
    },
  };
};

// 3. Get coupon details
const GetCouponById = async (id: string) => {
  const coupon = await prisma.coupon.findUnique({ where: { id } });

  if (!coupon) {
    throw new AppError(404, "Coupon not found");
  }

  return coupon;
};

// 4. Update coupon
const UpdateCoupon = async (id: string, payload: IUpdateCouponInput) => {
  return prisma.$transaction(async (tx) => {
    await lockCouponById(tx, id);

    const coupon = await tx.coupon.findUniqueOrThrow({ where: { id } });

    checkCouponSettings({ ...coupon, ...payload }, coupon.usedCount);

    return tx.coupon.update({
      where: { id },
      data: payload,
    });
  }, { isolationLevel: "ReadCommitted" }).catch(handleCouponError);
};

// 5. Update coupon status
const UpdateCouponStatus = async (id: string, isActive: boolean) => {
  return prisma.coupon.update({
    where: { id },
    data: { isActive },
  }).catch(handleCouponError);
};

// 6. Delete coupon
const DeleteCoupon = async (id: string) => {
  return prisma.$transaction(async (tx) => {
    await lockCouponById(tx, id);

    const result = await tx.coupon.deleteMany({
      where: {
        id,
        usedCount: 0,
        orders: { none: {} },
      },
    });

    if (result.count === 0) {
      throw new AppError(409, "This coupon has been used. Deactivate it instead.");
    }

    return { id };
  }, { isolationLevel: "ReadCommitted" });
};

// 7. Validate coupon before checkout
const ValidateCoupon = async (payload: IValidateCouponInput, userId?: string) => {
  return prisma.$transaction(async (tx) => {
    const { subtotalCents, deliveryChargeCents } = await priceCart(
      tx,
      payload.items,
    );

    const coupon = await evaluateCoupon(
      tx,
      payload.code,
      subtotalCents,
      deliveryChargeCents,
      userId,
    );

    const totalCents = subtotalCents + deliveryChargeCents - coupon.discountCents;

    return {
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      subtotal: toMoney(subtotalCents),
      discountAmount: toMoney(coupon.discountCents),
      deliveryCharge: toMoney(deliveryChargeCents),
      totalAmount: toMoney(totalCents),
    };
  }, { isolationLevel: "RepeatableRead" });
};

export const couponService = {
  CreateCoupon,
  GetAllCoupons,
  GetCouponById,
  UpdateCoupon,
  UpdateCouponStatus,
  DeleteCoupon,
  ValidateCoupon,
};