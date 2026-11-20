import type { Prisma } from "../../generated/prisma/client.ts";
import { DiscountType } from "../../generated/prisma/enums.ts";
import { AppError } from "../../utils/AppError.ts";
import { toCents } from "../../utils/money.ts";

export const evaluateCoupon = async (
  tx: Prisma.TransactionClient,
  code: string,
  subtotalCents: bigint,
  deliveryChargeCents: bigint,
  userId?: string,
) => {
  const coupon = await tx.coupon.findUnique({ where: { code } });

  if (!coupon || !coupon.isActive) {
    throw new AppError(400, "Invalid or inactive coupon");
  }

  const now = new Date();

  if (now < coupon.startDate || now > coupon.expiryDate) {
    throw new AppError(400, "Coupon is not currently valid");
  }

  if (subtotalCents < toCents(coupon.minOrderAmount.toFixed(2))) {
    throw new AppError(400, "Minimum order amount not reached");
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError(400, "Coupon usage limit exceeded");
  }

  if (coupon.perUserLimit !== null) {
    if (!userId) {
      throw new AppError(401, "Sign in to use this coupon");
    }

    const userOrders = await tx.order.count({
      where: { userId, couponId: coupon.id },
    });

    if (userOrders >= coupon.perUserLimit) {
      throw new AppError(400, "You have reached your coupon limit");
    }
  }

  const value = toCents(coupon.discountValue.toFixed(2));
  let discountCents = 0n;

  if (coupon.discountType === DiscountType.PERCENTAGE) {
    // 10.50% এখানে 1050 হিসেবে আছে, তাই 10000 দিয়ে ভাগ হচ্ছে।
    discountCents = (subtotalCents * value) / 10000n;

    if (coupon.maxDiscountAmount !== null) {
      const maximum = toCents(coupon.maxDiscountAmount.toFixed(2));

      if (discountCents > maximum) {
        discountCents = maximum;
      }
    }
  } else if (coupon.discountType === DiscountType.FIXED) {
    discountCents = value;
  }

  if (discountCents > subtotalCents) {
    discountCents = subtotalCents;
  }

  if (coupon.discountType === DiscountType.FREE_DELIVERY) {
    discountCents = deliveryChargeCents;
  }

  return {
    id: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountCents,
  };
};

export const redeemCoupon = async (
  tx: Prisma.TransactionClient,
  code: string,
  subtotalCents: bigint,
  deliveryChargeCents: bigint,
  userId?: string,
) => {
  // দুজন একসঙ্গে শেষ কুপনটি ব্যবহার করলে একজনের অর্ডার আগে শেষ হবে।
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM coupons WHERE code = ${code} FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new AppError(400, "Invalid or inactive coupon");
  }

  const coupon = await evaluateCoupon(
    tx,
    code,
    subtotalCents,
    deliveryChargeCents,
    userId,
  );

  await tx.coupon.update({
    where: { id: coupon.id },
    data: { usedCount: { increment: 1 } },
  });

  return coupon;
};