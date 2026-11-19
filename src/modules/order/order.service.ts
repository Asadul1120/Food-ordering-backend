// import { randomBytes } from "node:crypto";
// import { prisma } from "../../lib/prisma.ts";
// import type { Prisma } from "../../generated/prisma/client.ts";

// import { AppError } from "../../utils/AppError.ts";
// import {
//   PaymentStatus,
//   DiscountType,
//   OrderStatus,
//   UserRole,
//   PaymentMethod,
// } from "../../generated/prisma/enums.ts";
// import type {
//   ICreateOrderInput,
//   IMyOrdersQuery,
//   IOrderQuery,
//   IUpdateOrderStatusInput,
// } from "./order.interface.ts";

// const toCents = (value: string) => {
//   const [whole, fraction = ""] = value.split(".");

//   return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
// };

// const toMoney = (cents: bigint) => {
//   const whole = cents / 100n;
//   const fraction = (cents % 100n).toString().padStart(2, "0");

//   return `${whole}.${fraction}`;
// };

// const CreateOrder = async (payload: ICreateOrderInput, userId?: string) => {
//   const {
//     customerName,
//     customerPhone,
//     deliveryAddress,
//     orderNote,
//     couponCode,
//     paymentMethod,
//     items,
//   } = payload;

//   //   const orderNumber = `ORD-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

//   const orderNumber = `ORD-${randomBytes(16).toString("hex").toUpperCase()}`;

//   const itemMap = new Map<string, number>();

//   for (const item of items) {
//     itemMap.set(
//       item.productId,
//       (itemMap.get(item.productId) || 0) + item.quantity,
//     );
//   }

//   for (const quantity of itemMap.values()) {
//     if (quantity > 99) {
//       throw new AppError(400, "Maximum quantity for one product is 99");
//     }
//   }

//   const productIds = [...itemMap.keys()];

//   return prisma.$transaction(async (tx) => {
//     const products = await tx.product.findMany({
//       where: {
//         id: {
//           in: productIds,
//         },
//       },
//       select: {
//         id: true,
//         name: true,
//         price: true,
//         isAvailable: true,
//         category: {
//           select: {
//             isActive: true,
//           },
//         },
//       },
//     });

//     if (products.length !== productIds.length) {
//       throw new AppError(404, "One or more products were not found");
//     }

//     const unavailableProduct = products.find(
//       (product) => !product.isAvailable || !product.category.isActive,
//     );

//     if (unavailableProduct) {
//       throw new AppError(
//         409,
//         `${unavailableProduct.name} is currently unavailable`,
//       );
//     }

//     const productMap = new Map(
//       products.map((product) => [product.id, product]),
//     );

//     let subtotalCents = 0n;

//     const orderItems = productIds.map((productId) => {
//       const product = productMap.get(productId)!;

//       const quantity = itemMap.get(productId)!;

//       const productPriceCents = toCents(product.price.toString());

//       const itemSubtotalCents = productPriceCents * BigInt(quantity);

//       subtotalCents += itemSubtotalCents;

//       return {
//         productId: product.id,
//         productName: product.name,
//         productPrice: toMoney(productPriceCents),
//         quantity,
//         subtotal: toMoney(itemSubtotalCents),
//       };
//     });

//     const deliveryChargeCents = 0n;

//     let discountCents = 0n;

//     let couponId: string | null = null;

//     if (couponCode) {
//       const coupon = await tx.coupon.findUnique({
//         where: {
//           code: couponCode,
//         },
//       });

//       if (!coupon || !coupon.isActive) {
//         throw new AppError(400, "Invalid or inactive coupon");
//       }

//       const currentDate = new Date();

//       if (currentDate < coupon.startDate || currentDate > coupon.expiryDate) {
//         throw new AppError(400, "Coupon is not currently valid");
//       }

//       if (subtotalCents < toCents(coupon.minOrderAmount.toString())) {
//         throw new AppError(
//           400,
//           "Minimum order amount not reached for this coupon",
//         );
//       }

//       if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
//         throw new AppError(400, "Coupon usage limit exceeded");
//       }

//       const discountValueCents = toCents(coupon.discountValue.toString());

//       if (coupon.discountType === DiscountType.PERCENTAGE) {
//         discountCents = (subtotalCents * discountValueCents) / 10000n;

//         if (coupon.maxDiscountAmount !== null) {
//           const maxDiscountCents = toCents(coupon.maxDiscountAmount.toString());

//           if (discountCents > maxDiscountCents) {
//             discountCents = maxDiscountCents;
//           }
//         }
//       } else if (coupon.discountType === DiscountType.FIXED) {
//         discountCents = discountValueCents;
//       } else if (coupon.discountType === DiscountType.FREE_DELIVERY) {
//         discountCents = deliveryChargeCents;
//       }

//       if (discountCents > subtotalCents) {
//         discountCents = subtotalCents;
//       }

//       couponId = coupon.id;

//       const couponUpdate = await tx.coupon.updateMany({
//         where: {
//           id: coupon.id,
//           ...(coupon.usageLimit !== null && {
//             usedCount: {
//               lt: coupon.usageLimit,
//             },
//           }),
//         },
//         data: {
//           usedCount: {
//             increment: 1,
//           },
//         },
//       });

//       if (couponUpdate.count === 0) {
//         throw new AppError(400, "Coupon usage limit exceeded");
//       }
//     }

//     const totalCents = subtotalCents - discountCents + deliveryChargeCents;

//     const order = await tx.order.create({
//       data: {
//         orderNumber,
//         userId: userId ?? null,
//         couponId,
//         customerName,
//         customerPhone,
//         deliveryAddress,
//         orderNote: orderNote || null,
//         subtotal: toMoney(subtotalCents),
//         discountAmount: toMoney(discountCents),
//         deliveryCharge: toMoney(deliveryChargeCents),
//         totalAmount: toMoney(totalCents),

//         orderItems: {
//           create: orderItems,
//         },

//         payments: {
//           create: {
//             amount: toMoney(totalCents),
//             paymentMethod,
//             paymentStatus: PaymentStatus.PENDING,
//           },
//         },
//       },
//       select: {
//         id: true,
//         orderNumber: true,
//         userId: true,
//         customerName: true,
//         customerPhone: true,
//         deliveryAddress: true,
//         orderNote: true,
//         subtotal: true,
//         discountAmount: true,
//         deliveryCharge: true,
//         totalAmount: true,
//         orderStatus: true,
//         createdAt: true,
//         orderItems: {
//           select: {
//             id: true,
//             productId: true,
//             productName: true,
//             productPrice: true,
//             quantity: true,
//             subtotal: true,
//           },
//         },
//         payments: {
//           select: {
//             id: true,
//             amount: true,
//             paymentMethod: true,
//             paymentStatus: true,
//             providerPaymentId: true,
//           },
//         },
//       },
//     });

//     return order;
//   });
// };

// const GetAllOrders = async (query: IOrderQuery) => {
//   const { page, limit, search, orderStatus } = query;

//   const skip = (page - 1) * limit;

//   const where: Prisma.OrderWhereInput = {
//     ...(orderStatus && {
//       orderStatus,
//     }),

//     ...(search && {
//       OR: [
//         {
//           orderNumber: {
//             contains: search,
//             mode: "insensitive",
//           },
//         },
//         {
//           customerName: {
//             contains: search,
//             mode: "insensitive",
//           },
//         },
//         {
//           customerPhone: {
//             contains: search,
//           },
//         },
//       ],
//     }),
//   };

//   const [orders, totalOrders] = await prisma.$transaction([
//     prisma.order.findMany({
//       where,
//       skip,
//       take: limit,
//       orderBy: {
//         createdAt: "desc",
//       },
//       select: {
//         id: true,
//         orderNumber: true,
//         userId: true,
//         customerName: true,
//         customerPhone: true,
//         deliveryAddress: true,
//         subtotal: true,
//         discountAmount: true,
//         deliveryCharge: true,
//         totalAmount: true,
//         orderStatus: true,
//         createdAt: true,
//         updatedAt: true,
//         _count: {
//           select: {
//             orderItems: true,
//           },
//         },
//         payments: {
//           select: {
//             id: true,
//             amount: true,
//             paymentMethod: true,
//             paymentStatus: true,
//             createdAt: true,
//           },
//         },
//       },
//     }),

//     prisma.order.count({
//       where,
//     }),
//   ]);

//   return {
//     orders,
//     pagination: {
//       totalOrders,
//       currentPage: page,
//       totalPages: Math.ceil(totalOrders / limit),
//       limit,
//     },
//   };
// };

// const GetOrderById = async (orderId: string) => {
//   const order = await prisma.order.findUnique({
//     where: {
//       id: orderId,
//     },
//     select: {
//       id: true,
//       orderNumber: true,
//       userId: true,
//       customerName: true,
//       customerPhone: true,
//       deliveryAddress: true,
//       orderNote: true,
//       subtotal: true,
//       discountAmount: true,
//       deliveryCharge: true,
//       totalAmount: true,
//       orderStatus: true,
//       createdAt: true,
//       updatedAt: true,

//       orderItems: {
//         select: {
//           id: true,
//           productId: true,
//           productName: true,
//           productPrice: true,
//           quantity: true,
//           subtotal: true,
//           createdAt: true,
//         },
//       },

//       payments: {
//         select: {
//           id: true,
//           amount: true,
//           paymentMethod: true,
//           paymentStatus: true,
//           transactionId: true,
//           paymentProvider: true,
//           paidAt: true,
//           createdAt: true,
//           updatedAt: true,
//         },
//       },

//       coupon: {
//         select: {
//           id: true,
//           code: true,
//           discountType: true,
//           discountValue: true,
//         },
//       },
//     },
//   });

//   if (!order) {
//     throw new AppError(404, "Order not found");
//   }

//   return order;
// };

// const GetMyOrders = async (userId: string, query: IMyOrdersQuery) => {
//   const { page, limit, orderStatus } = query;

//   const skip = (page - 1) * limit;

//   const where: Prisma.OrderWhereInput = {
//     userId,

//     ...(orderStatus && {
//       orderStatus,
//     }),
//   };

//   const [orders, totalOrders] = await prisma.$transaction([
//     prisma.order.findMany({
//       where,
//       skip,
//       take: limit,
//       orderBy: {
//         createdAt: "desc",
//       },
//       select: {
//         id: true,
//         orderNumber: true,
//         customerName: true,
//         customerPhone: true,
//         deliveryAddress: true,
//         subtotal: true,
//         discountAmount: true,
//         deliveryCharge: true,
//         totalAmount: true,
//         orderStatus: true,
//         createdAt: true,
//         updatedAt: true,

//         orderItems: {
//           select: {
//             id: true,
//             productId: true,
//             productName: true,
//             productPrice: true,
//             quantity: true,
//             subtotal: true,
//           },
//         },

//         payments: {
//           select: {
//             id: true,
//             amount: true,
//             paymentMethod: true,
//             paymentStatus: true,
//             paidAt: true,
//             createdAt: true,
//           },
//         },
//       },
//     }),

//     prisma.order.count({
//       where,
//     }),
//   ]);

//   return {
//     orders,
//     pagination: {
//       totalOrders,
//       currentPage: page,
//       totalPages: Math.ceil(totalOrders / limit),
//       limit,
//     },
//   };
// };

// const GetOrderTracking = async (orderNumber: string) => {
//   const order = await prisma.order.findUnique({
//     where: {
//       orderNumber,
//     },
//     select: {
//       customerName: true,
//       customerPhone: true,
//       deliveryAddress: true,
//       orderNumber: true,
//       orderStatus: true,
//       createdAt: true,
//       updatedAt: true,
//       payments: {
//         select: {
//           paymentStatus: true,
//           paidAt: true,
//         },
//       },
//     },
//   });

//   if (!order) {
//     throw new AppError(404, "Order not found");
//   }

//   return order;
// };

// const CheckOrderPayment = (
//   payments: {
//     paymentMethod: PaymentMethod;
//     paymentStatus: PaymentStatus;
//     providerPaymentId: string | null;
//   }[],
//   orderStatus: OrderStatus,
// ) => {
//   const hasPaidPayment = payments.some(
//     (payment) => payment.paymentStatus === PaymentStatus.PAID,
//   );

//   const hasBkashPayment = payments.some(
//     (payment) => payment.paymentMethod === PaymentMethod.BKASH,
//   );

//   // bKash order must be paid before confirmation
//   if (
//     orderStatus === OrderStatus.CONFIRMED &&
//     hasBkashPayment &&
//     !hasPaidPayment
//   ) {
//     throw new AppError(400, "Complete bKash payment before confirming order");
//   }

//   if (orderStatus === OrderStatus.CANCELLED) {
//     if (hasPaidPayment) {
//       throw new AppError(
//         409,
//         "Please process the refund before cancelling order",
//       );
//     }

//     const hasActivePayment = payments.some(
//       (payment) =>
//         payment.paymentMethod !== PaymentMethod.CASH_ON_DELIVERY &&
//         payment.paymentStatus === PaymentStatus.PENDING &&
//         payment.providerPaymentId !== null,
//     );

//     if (hasActivePayment) {
//       throw new AppError(
//         409,
//         "Resolve the active online payment before cancellation",
//       );
//     }
//   }
// };

// const UpdateOrderStatus = async (
//   orderId: string,
//   payload: IUpdateOrderStatusInput,
// ) => {
//   return prisma.$transaction(async (tx) => {
//     await tx.$queryRaw`
//       SELECT id FROM orders
//       WHERE id = ${orderId}
//       FOR UPDATE
//     `;

//     const existingOrder = await tx.order.findUnique({
//       where: {
//         id: orderId,
//       },
//       select: {
//         id: true,
//         orderNumber: true,
//         orderStatus: true,

//         payments: {
//           select: {
//             paymentMethod: true,
//             paymentStatus: true,
//             providerPaymentId: true,
//           },
//         },
//       },
//     });

//     if (!existingOrder) {
//       throw new AppError(404, "Order not found");
//     }

//     const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
//       PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],

//       CONFIRMED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],

//       PREPARING: [OrderStatus.READY, OrderStatus.CANCELLED],

//       READY: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],

//       OUT_FOR_DELIVERY: [OrderStatus.DELIVERED],

//       DELIVERED: [],

//       CANCELLED: [],
//     };

//     if (
//       !allowedTransitions[existingOrder.orderStatus].includes(
//         payload.orderStatus,
//       )
//     ) {
//       throw new AppError(
//         400,
//         `Cannot change order status from ${existingOrder.orderStatus} to ${payload.orderStatus}`,
//       );
//     }

//     CheckOrderPayment(existingOrder.payments, payload.orderStatus);

//     const order = await tx.order.update({
//       where: {
//         id: orderId,
//       },
//       data: {
//         orderStatus: payload.orderStatus,
//       },
//       select: {
//         id: true,
//         orderNumber: true,
//         orderStatus: true,
//         updatedAt: true,
//       },
//     });

//     // Cancel all unpaid payment attempts
//     if (payload.orderStatus === OrderStatus.CANCELLED) {
//       await tx.payment.updateMany({
//         where: {
//           orderId,
//           paymentStatus: PaymentStatus.PENDING,
//         },
//         data: {
//           paymentStatus: PaymentStatus.FAILED,
//           checkoutUrl: null,
//         },
//       });
//     }

//     return order;
//   });
// };
// const CancelOrder = async (
//   orderId: string,
//   userId: string,
//   userRole: UserRole,
// ) => {
//   return prisma.$transaction(async (tx) => {
//     await tx.$queryRaw`
//   SELECT id FROM orders
//   WHERE id = ${orderId}
//   FOR UPDATE
// `;
//     const existingOrder = await tx.order.findUnique({
//       where: {
//         id: orderId,
//       },
//       select: {
//         id: true,
//         orderNumber: true,
//         userId: true,
//         orderStatus: true,
//         payments: {
//           select: {
//             paymentStatus: true,
//           },
//         },
//       },
//     });

//     if (!existingOrder) {
//       throw new AppError(404, "Order not found");
//     }

//     if (userRole === UserRole.CUSTOMER && existingOrder.userId !== userId) {
//       throw new AppError(403, "You are not allowed to cancel this order");
//     }

//     if (userRole !== UserRole.ADMIN && userRole !== UserRole.CUSTOMER) {
//       throw new AppError(403, "You do not have permission");
//     }

//     const allowedStatuses: OrderStatus[] =
//       userRole === UserRole.ADMIN
//         ? [
//             OrderStatus.PENDING,
//             OrderStatus.CONFIRMED,
//             OrderStatus.PREPARING,
//             OrderStatus.READY,
//           ]
//         : [OrderStatus.PENDING, OrderStatus.CONFIRMED];

//     if (!allowedStatuses.includes(existingOrder.orderStatus)) {
//       throw new AppError(
//         400,
//         `Order cannot be cancelled from ${existingOrder.orderStatus} status`,
//       );
//     }

//     const hasPaidPayment = existingOrder.payments.some(
//       (payment) => payment.paymentStatus === PaymentStatus.PAID,
//     );

//     if (hasPaidPayment) {
//       throw new AppError(
//         409,
//         "This order has been paid. Refund must be processed before cancellation",
//       );
//     }

//     const updatedOrder = await tx.order.updateMany({
//       where: {
//         id: orderId,
//         orderStatus: existingOrder.orderStatus,
//       },
//       data: {
//         orderStatus: OrderStatus.CANCELLED,
//       },
//     });

//     if (updatedOrder.count === 0) {
//       throw new AppError(
//         409,
//         "Order status changed. Please refresh and try again",
//       );
//     }

//     const order = await tx.order.findUnique({
//       where: {
//         id: orderId,
//       },
//       select: {
//         id: true,
//         orderNumber: true,
//         orderStatus: true,
//         updatedAt: true,
//       },
//     });

//     return order;
//   });
// };

// export const orderService = {
//   CreateOrder,
//   GetAllOrders,
//   GetOrderById,
//   GetMyOrders,
//   GetOrderTracking,
//   CheckOrderPayment,
//   UpdateOrderStatus,
//   CancelOrder,
// };





import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../../lib/prisma.ts";
import type { Prisma } from "../../generated/prisma/client.ts";

import { AppError } from "../../utils/AppError.ts";

import {
  PaymentStatus,
  DiscountType,
  OrderStatus,
  UserRole,
  PaymentMethod,
} from "../../generated/prisma/enums.ts";

import type {
  ICreateOrderInput,
  IMyOrdersQuery,
  IOrderQuery,
  IUpdateOrderStatusInput,
} from "./order.interface.ts";

// Convert money to cents
const toCents = (value: string) => {
  const [whole, fraction = ""] = value.split(".");

  return (
    BigInt(whole) * 100n +
    BigInt((fraction + "00").slice(0, 2))
  );
};

// Convert cents to money
const toMoney = (cents: bigint) => {
  const whole = cents / 100n;
  const fraction = (cents % 100n)
    .toString()
    .padStart(2, "0");

  return `${whole}.${fraction}`;
};

// 1. Create Order
const CreateOrder = async (
  payload: ICreateOrderInput,
  userId?: string,
) => {
  const {
    customerName,
    customerPhone,
    deliveryAddress,
    orderNote,
    couponCode,
    paymentMethod,
    items,
  } = payload;

  // Only bKash and Cash on Delivery are supported
  if (
    paymentMethod !== PaymentMethod.BKASH &&
    paymentMethod !== PaymentMethod.CASH_ON_DELIVERY
  ) {
    throw new AppError(400, "Invalid payment method");
  }

  // Generate unique order number
  const orderNumber = `ORD-${randomBytes(16)
    .toString("hex")
    .toUpperCase()}`;

  // Generate guest payment token
  const guestToken = userId
    ? null
    : randomBytes(32).toString("hex");

  // Store only the hashed token in database
  const guestTokenHash = guestToken
    ? createHash("sha256").update(guestToken).digest("hex")
    : null;

  // Combine duplicate products
  const itemMap = new Map<string, number>();

  for (const item of items) {
    itemMap.set(
      item.productId,
      (itemMap.get(item.productId) || 0) + item.quantity,
    );
  }

  // Check maximum quantity
  for (const quantity of itemMap.values()) {
    if (quantity > 99) {
      throw new AppError(
        400,
        "Maximum quantity for one product is 99",
      );
    }
  }

  const productIds = [...itemMap.keys()];

  return prisma.$transaction(async (tx) => {
    // Get products from database
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
      throw new AppError(
        404,
        "One or more products were not found",
      );
    }

    // Check product availability
    const unavailableProduct = products.find(
      (product) =>
        !product.isAvailable ||
        !product.category.isActive,
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

    // Prepare order items
    const orderItems = productIds.map((productId) => {
      const product = productMap.get(productId)!;

      const quantity = itemMap.get(productId)!;

      const productPriceCents = toCents(
        product.price.toString(),
      );

      const itemSubtotalCents =
        productPriceCents * BigInt(quantity);

      subtotalCents += itemSubtotalCents;

      return {
        productId: product.id,
        productName: product.name,
        productPrice: toMoney(productPriceCents),
        quantity,
        subtotal: toMoney(itemSubtotalCents),
      };
    });

    // Delivery charge
    const deliveryChargeCents = 0n;

    let discountCents = 0n;

    let couponId: string | null = null;

    // Apply coupon
    if (couponCode) {
      const coupon = await tx.coupon.findUnique({
        where: {
          code: couponCode,
        },
      });

      if (!coupon || !coupon.isActive) {
        throw new AppError(
          400,
          "Invalid or inactive coupon",
        );
      }

      const currentDate = new Date();

      // Check coupon validity
      if (
        currentDate < coupon.startDate ||
        currentDate > coupon.expiryDate
      ) {
        throw new AppError(
          400,
          "Coupon is not currently valid",
        );
      }

      // Check minimum order amount
      if (
        subtotalCents <
        toCents(coupon.minOrderAmount.toString())
      ) {
        throw new AppError(
          400,
          "Minimum order amount not reached for this coupon",
        );
      }

      // Check coupon usage limit
      if (
        coupon.usageLimit !== null &&
        coupon.usedCount >= coupon.usageLimit
      ) {
        throw new AppError(
          400,
          "Coupon usage limit exceeded",
        );
      }

      const discountValueCents = toCents(
        coupon.discountValue.toString(),
      );

      // Percentage discount
      if (
        coupon.discountType === DiscountType.PERCENTAGE
      ) {
        discountCents =
          (subtotalCents * discountValueCents) / 10000n;

        if (coupon.maxDiscountAmount !== null) {
          const maxDiscountCents = toCents(
            coupon.maxDiscountAmount.toString(),
          );

          if (discountCents > maxDiscountCents) {
            discountCents = maxDiscountCents;
          }
        }
      }

      // Fixed discount
      else if (
        coupon.discountType === DiscountType.FIXED
      ) {
        discountCents = discountValueCents;
      }

      // Free delivery discount
      else if (
        coupon.discountType ===
        DiscountType.FREE_DELIVERY
      ) {
        discountCents = deliveryChargeCents;
      }

      // Prevent negative total
      if (discountCents > subtotalCents) {
        discountCents = subtotalCents;
      }

      couponId = coupon.id;

      // Update coupon usage
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
        throw new AppError(
          400,
          "Coupon usage limit exceeded",
        );
      }
    }

    // Calculate total amount
    const totalCents =
      subtotalCents -
      discountCents +
      deliveryChargeCents;

    // bKash does not support zero amount orders
    if (
      paymentMethod === PaymentMethod.BKASH &&
      totalCents <= 0n
    ) {
      throw new AppError(
        400,
        "Please select Cash on Delivery for a zero amount order",
      );
    }

    // Create order along with order items and payment
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: userId ?? null,
        guestTokenHash,
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
          orderBy: {
            createdAt: "desc",
          },

          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            paymentStatus: true,
            providerPaymentId: true,
          },
        },
      },
    });

    // Return guest token only when creating an order
    return {
      ...order,
      guestToken,
    };
  });
};

// 2. Get All Orders
const GetAllOrders = async (query: IOrderQuery) => {
  const {
    page,
    limit,
    search,
    orderStatus,
  } = query;

  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    ...(orderStatus && {
      orderStatus,
    }),

    ...(search && {
      OR: [
        {
          orderNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerPhone: {
            contains: search,
          },
        },
      ],
    }),
  };

  const [orders, totalOrders] =
    await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take: limit,

        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          orderNumber: true,
          userId: true,
          customerName: true,
          customerPhone: true,
          deliveryAddress: true,
          subtotal: true,
          discountAmount: true,
          deliveryCharge: true,
          totalAmount: true,
          orderStatus: true,
          createdAt: true,
          updatedAt: true,

          _count: {
            select: {
              orderItems: true,
            },
          },

          payments: {
            orderBy: {
              createdAt: "desc",
            },

            select: {
              id: true,
              amount: true,
              paymentMethod: true,
              paymentStatus: true,
              createdAt: true,
            },
          },
        },
      }),

      prisma.order.count({
        where,
      }),
    ]);

  return {
    orders,

    pagination: {
      totalOrders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      limit,
    },
  };
};

// 3. Get Order By ID
const GetOrderById = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
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
      updatedAt: true,

      orderItems: {
        select: {
          id: true,
          productId: true,
          productName: true,
          productPrice: true,
          quantity: true,
          subtotal: true,
          createdAt: true,
        },
      },

      payments: {
        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          paymentStatus: true,
          transactionId: true,
          paymentProvider: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },

      coupon: {
        select: {
          id: true,
          code: true,
          discountType: true,
          discountValue: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  return order;
};

// 4. Get My Orders
const GetMyOrders = async (
  userId: string,
  query: IMyOrdersQuery,
) => {
  const {
    page,
    limit,
    orderStatus,
  } = query;

  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    userId,

    ...(orderStatus && {
      orderStatus,
    }),
  };

  const [orders, totalOrders] =
    await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take: limit,

        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerPhone: true,
          deliveryAddress: true,
          subtotal: true,
          discountAmount: true,
          deliveryCharge: true,
          totalAmount: true,
          orderStatus: true,
          createdAt: true,
          updatedAt: true,

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
            orderBy: {
              createdAt: "desc",
            },

            select: {
              id: true,
              amount: true,
              paymentMethod: true,
              paymentStatus: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      }),

      prisma.order.count({
        where,
      }),
    ]);

  return {
    orders,

    pagination: {
      totalOrders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      limit,
    },
  };
};

// 5. Get Order Tracking
const GetOrderTracking = async (
  orderNumber: string,
) => {
  const order = await prisma.order.findUnique({
    where: {
      orderNumber,
    },

    select: {
      customerName: true,
      customerPhone: true,
      deliveryAddress: true,
      orderNumber: true,
      orderStatus: true,
      createdAt: true,
      updatedAt: true,

      payments: {
        orderBy: {
          createdAt: "desc",
        },

        select: {
          paymentStatus: true,
          paidAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  return order;
};

// Helper function to check order payment
const CheckOrderPayment = (
  payments: {
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    providerPaymentId: string | null;
  }[],
  orderStatus: OrderStatus,
) => {
  const hasPaidPayment = payments.some(
    (payment) =>
      payment.paymentStatus === PaymentStatus.PAID,
  );

  const hasBkashPayment = payments.some(
    (payment) =>
      payment.paymentMethod === PaymentMethod.BKASH,
  );

  // bKash order must be paid before confirmation
  if (
    orderStatus === OrderStatus.CONFIRMED &&
    hasBkashPayment &&
    !hasPaidPayment
  ) {
    throw new AppError(
      400,
      "Complete bKash payment before confirming order",
    );
  }

  // Check payment before cancellation
  if (orderStatus === OrderStatus.CANCELLED) {
    // Paid order cannot be cancelled without refund
    if (hasPaidPayment) {
      throw new AppError(
        409,
        "Please process the refund before cancelling order",
      );
    }

    // Check if an online payment is currently active
    const hasActivePayment = payments.some(
      (payment) =>
        payment.paymentMethod !==
          PaymentMethod.CASH_ON_DELIVERY &&
        payment.paymentStatus === PaymentStatus.PENDING &&
        payment.providerPaymentId !== null,
    );

    if (hasActivePayment) {
      throw new AppError(
        409,
        "Resolve the active online payment before cancellation",
      );
    }
  }
};

// 6. Update Order Status
const UpdateOrderStatus = async (
  orderId: string,
  payload: IUpdateOrderStatusInput,
) => {
  return prisma.$transaction(async (tx) => {
    // Lock order to prevent simultaneous updates
    await tx.$queryRaw`
      SELECT id FROM orders
      WHERE id = ${orderId}
      FOR UPDATE
    `;

    const existingOrder = await tx.order.findUnique({
      where: {
        id: orderId,
      },

      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,

        payments: {
          select: {
            paymentMethod: true,
            paymentStatus: true,
            providerPaymentId: true,
          },
        },
      },
    });

    if (!existingOrder) {
      throw new AppError(404, "Order not found");
    }

    // Allowed order status transitions
    const allowedTransitions: Record<
      OrderStatus,
      OrderStatus[]
    > = {
      PENDING: [
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
      ],

      CONFIRMED: [
        OrderStatus.PREPARING,
        OrderStatus.CANCELLED,
      ],

      PREPARING: [
        OrderStatus.READY,
        OrderStatus.CANCELLED,
      ],

      READY: [
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.CANCELLED,
      ],

      OUT_FOR_DELIVERY: [
        OrderStatus.DELIVERED,
      ],

      DELIVERED: [],

      CANCELLED: [],
    };

    // Validate order status transition
    if (
      !allowedTransitions[
        existingOrder.orderStatus
      ].includes(payload.orderStatus)
    ) {
      throw new AppError(
        400,
        `Cannot change order status from ${existingOrder.orderStatus} to ${payload.orderStatus}`,
      );
    }

    // Check payment before updating order status
    CheckOrderPayment(
      existingOrder.payments,
      payload.orderStatus,
    );

    // Update order status
    const order = await tx.order.update({
      where: {
        id: orderId,
      },

      data: {
        orderStatus: payload.orderStatus,
      },

      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        updatedAt: true,
      },
    });

    // Mark pending payments as failed on cancellation
    if (
      payload.orderStatus === OrderStatus.CANCELLED
    ) {
      await tx.payment.updateMany({
        where: {
          orderId,
          paymentStatus: PaymentStatus.PENDING,
        },

        data: {
          paymentStatus: PaymentStatus.FAILED,
          checkoutUrl: null,
        },
      });
    }

    return order;
  });
};

// 7. Cancel Order
const CancelOrder = async (
  orderId: string,
  userId: string,
  userRole: UserRole,
) => {
  return prisma.$transaction(async (tx) => {
    // Lock order before cancellation
    await tx.$queryRaw`
      SELECT id FROM orders
      WHERE id = ${orderId}
      FOR UPDATE
    `;

    const existingOrder = await tx.order.findUnique({
      where: {
        id: orderId,
      },

      select: {
        id: true,
        orderNumber: true,
        userId: true,
        orderStatus: true,

        payments: {
          select: {
            paymentMethod: true,
            paymentStatus: true,
            providerPaymentId: true,
          },
        },
      },
    });

    if (!existingOrder) {
      throw new AppError(404, "Order not found");
    }

    // Check customer ownership
    if (
      userRole === UserRole.CUSTOMER &&
      existingOrder.userId !== userId
    ) {
      throw new AppError(
        403,
        "You are not allowed to cancel this order",
      );
    }

    // Only admin and customer can use this service
    if (
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.CUSTOMER
    ) {
      throw new AppError(
        403,
        "You do not have permission",
      );
    }

    // Allowed cancellation statuses
    const allowedStatuses: OrderStatus[] =
      userRole === UserRole.ADMIN
        ? [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
          ]
        : [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
          ];

    if (
      !allowedStatuses.includes(
        existingOrder.orderStatus,
      )
    ) {
      throw new AppError(
        400,
        `Order cannot be cancelled from ${existingOrder.orderStatus} status`,
      );
    }

    // Check payment before cancelling order
    CheckOrderPayment(
      existingOrder.payments,
      OrderStatus.CANCELLED,
    );

    // Cancel order
    const updatedOrder = await tx.order.updateMany({
      where: {
        id: orderId,
        orderStatus: existingOrder.orderStatus,
      },

      data: {
        orderStatus: OrderStatus.CANCELLED,
      },
    });

    if (updatedOrder.count === 0) {
      throw new AppError(
        409,
        "Order status changed. Please refresh and try again",
      );
    }

    // Mark all pending payments as failed
    await tx.payment.updateMany({
      where: {
        orderId,
        paymentStatus: PaymentStatus.PENDING,
      },

      data: {
        paymentStatus: PaymentStatus.FAILED,
        checkoutUrl: null,
      },
    });

    // Get updated order
    const order = await tx.order.findUnique({
      where: {
        id: orderId,
      },

      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        updatedAt: true,
      },
    });

    return order;
  });
};

export const orderService = {
  CreateOrder,
  GetAllOrders,
  GetOrderById,
  GetMyOrders,
  GetOrderTracking,
  CheckOrderPayment,
  UpdateOrderStatus,
  CancelOrder,
};
