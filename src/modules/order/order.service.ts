import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";
import { PaymentStatus, DiscountType } from "../../generated/prisma/enums.ts";
import type { ICreateOrderInput } from "./order.interface.ts";



const toCents = (value: string) => {
  const [whole, fraction = ""] = value.split(".");

  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
};

const toMoney = (cents: bigint) => {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, "0");

  return `${whole}.${fraction}`;
};



const CreateOrder = async (payload: ICreateOrderInput, userId?: string) => {
  const {
    customerName,
    customerPhone,
    deliveryAddress,
    orderNote,
    couponCode,
    paymentMethod,
    items,
  } = payload;

  const orderNumber = `ORD-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

  const itemMap = new Map<string, number>();

  for (const item of items) {
    itemMap.set(
      item.productId,
      (itemMap.get(item.productId) || 0) + item.quantity,
    );
  }

  for (const quantity of itemMap.values()) {
    if (quantity > 99) {
      throw new AppError(400, "Maximum quantity for one product is 99");
    }
  }

  const productIds = [...itemMap.keys()];

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        name: true,
        price: true,
        isAvailable: true,
        category: {
          select: {
            isActive: true,
          },
        },
      },
    });

    if (products.length !== productIds.length) {
      throw new AppError(404, "One or more products were not found");
    }

    const unavailableProduct = products.find(
      (product) => !product.isAvailable || !product.category.isActive,
    );

    if (unavailableProduct) {
      throw new AppError(
        409,
        `${unavailableProduct.name} is currently unavailable`,
      );
    }

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    let subtotalCents = 0n;

    const orderItems = productIds.map((productId) => {
      const product = productMap.get(productId)!;

      const quantity = itemMap.get(productId)!;

      const productPriceCents = toCents(product.price.toString());

      const itemSubtotalCents = productPriceCents * BigInt(quantity);

      subtotalCents += itemSubtotalCents;

      return {
        productId: product.id,
        productName: product.name,
        productPrice: toMoney(productPriceCents),
        quantity,
        subtotal: toMoney(itemSubtotalCents),
      };
    });

    const deliveryChargeCents = 0n;

    let discountCents = 0n;

    let couponId: string | null = null;

    if (couponCode) {
      const coupon = await tx.coupon.findUnique({
        where: {
          code: couponCode,
        },
      });

      if (!coupon || !coupon.isActive) {
        throw new AppError(400, "Invalid or inactive coupon");
      }

      const currentDate = new Date();

      if (currentDate < coupon.startDate || currentDate > coupon.expiryDate) {
        throw new AppError(400, "Coupon is not currently valid");
      }

      if (subtotalCents < toCents(coupon.minOrderAmount.toString())) {
        throw new AppError(
          400,
          "Minimum order amount not reached for this coupon",
        );
      }

      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw new AppError(400, "Coupon usage limit exceeded");
      }

      const discountValueCents = toCents(coupon.discountValue.toString());

      if (coupon.discountType === DiscountType.PERCENTAGE) {
        discountCents = (subtotalCents * discountValueCents) / 10000n;

        if (coupon.maxDiscountAmount !== null) {
          const maxDiscountCents = toCents(coupon.maxDiscountAmount.toString());

          if (discountCents > maxDiscountCents) {
            discountCents = maxDiscountCents;
          }
        }
      } else if (coupon.discountType === DiscountType.FIXED) {
        discountCents = discountValueCents;
      } else if (coupon.discountType === DiscountType.FREE_DELIVERY) {
        discountCents = deliveryChargeCents;
      }

      if (discountCents > subtotalCents) {
        discountCents = subtotalCents;
      }

      couponId = coupon.id;

      const couponUpdate = await tx.coupon.updateMany({
        where: {
          id: coupon.id,
          ...(coupon.usageLimit !== null && {
            usedCount: {
              lt: coupon.usageLimit,
            },
          }),
        },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });

      if (couponUpdate.count === 0) {
        throw new AppError(400, "Coupon usage limit exceeded");
      }
    }

    const totalCents = subtotalCents - discountCents + deliveryChargeCents;

    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: userId ?? null,
        couponId,
        customerName,
        customerPhone,
        deliveryAddress,
        orderNote: orderNote || null,
        subtotal: toMoney(subtotalCents),
        discountAmount: toMoney(discountCents),
        deliveryCharge: toMoney(deliveryChargeCents),
        totalAmount: toMoney(totalCents),

        orderItems: {
          create: orderItems,
        },

        payments: {
          create: {
            amount: toMoney(totalCents),
            paymentMethod,
            paymentStatus: PaymentStatus.PENDING,
          },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        customerName: true,
        customerPhone: true,
        deliveryAddress: true,
        orderNote: true,
        subtotal: true,
        discountAmount: true,
        deliveryCharge: true,
        totalAmount: true,
        orderStatus: true,
        createdAt: true,
        orderItems: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productPrice: true,
            quantity: true,
            subtotal: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            paymentStatus: true,
          },
        },
      },
    });

    return order;
  });
};

export const orderService = {
  CreateOrder,
};
