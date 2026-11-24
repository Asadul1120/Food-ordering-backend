import { randomBytes, createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.ts";

import {
  PaymentStatus,
  OrderStatus,
  UserRole,
  PaymentMethod,
} from "../../generated/prisma/enums.ts";

import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";
import { toMoney } from "../../utils/money.ts";
import { redeemCoupon } from "../coupon/coupon-pricing.ts";
import { priceCart } from "./order-pricing.ts";

import type {
  ICreateOrderInput,
  IMyOrdersQuery,
  IOrderQuery,
  IUpdateOrderStatusInput,
} from "./order.interface.ts";

// 1. Create order
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

  if (
    paymentMethod !== PaymentMethod.BKASH &&
    paymentMethod !== PaymentMethod.CASH_ON_DELIVERY
  ) {
    throw new AppError(400, "Invalid payment method");
  }

  const orderNumber = `ORD-${randomBytes(16).toString("hex").toUpperCase()}`;

  const guestToken = userId ? null : randomBytes(32).toString("hex");

  const guestTokenHash = guestToken
    ? createHash("sha256").update(guestToken).digest("hex")
    : null;

  return prisma.$transaction(
    async (tx) => {
      const { orderItems, subtotalCents, deliveryChargeCents } =
        await priceCart(tx, items);

      let couponId: string | null = null;
      let discountCents = 0n;

      if (couponCode) {
        const coupon = await redeemCoupon(
          tx,
          couponCode,
          subtotalCents,
          deliveryChargeCents,
          userId,
        );

        couponId = coupon.id;
        discountCents = coupon.discountCents;
      }

      const totalCents = subtotalCents - discountCents + deliveryChargeCents;

      if (paymentMethod === PaymentMethod.BKASH && totalCents <= 0n) {
        throw new AppError(
          400,
          "Please select Cash on Delivery for a zero amount order",
        );
      }

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
            orderBy: { createdAt: "desc" },
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

      return { ...order, guestToken };
    },
    { isolationLevel: "ReadCommitted" },
  );
};

// 2. Get all orders
const GetAllOrders = async (query: IOrderQuery) => {
  const { page, limit, search, orderStatus } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    ...(orderStatus && { orderStatus }),
    ...(search && {
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
      ],
    }),
  };

  const [orders, totalOrders] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },

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
          select: { orderItems: true },
        },

        payments: {
          orderBy: { createdAt: "desc" },
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

    prisma.order.count({ where }),
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

// 3. Get order by ID
const GetOrderById = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },

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
        orderBy: { createdAt: "desc" },
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

// 4. Get my orders
const GetMyOrders = async (userId: string, query: IMyOrdersQuery) => {
  const { page, limit, orderStatus } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    userId,
    ...(orderStatus && { orderStatus }),
  };

  const [orders, totalOrders] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },

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
          orderBy: { createdAt: "desc" },
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

    prisma.order.count({ where }),
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

// 5. Track order
const GetOrderTracking = async (orderNumber: string, customerPhone: string) => {
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

  // Do not reveal whether an order number exists
  // if the supplied mobile number is incorrect.
  if (!order) {
    throw new AppError(
      404,
      "Order not found. Please check your order number and mobile number.",
    );
  }

  // Compare the mobile number with the saved order number
  const savedPhone = order.customerPhone.trim();
  const enteredPhone = customerPhone.trim();

  if (savedPhone !== enteredPhone) {
    throw new AppError(
      404,
      "Order not found. Please check your order number and mobile number.",
    );
  }

  // Hide part of the mobile number in the public response
  const maskedPhone =
    savedPhone.length > 7
      ? `${savedPhone.slice(0, 4)}****${savedPhone.slice(-3)}`
      : "****";

  return {
    ...order,
    customerPhone: maskedPhone,
  };
};

const allBkashAttemptsFailed = (
  payments: {
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
  }[],
) =>
  payments.length > 0 &&
  payments.every(
    (payment) =>
      payment.paymentMethod === PaymentMethod.BKASH &&
      payment.paymentStatus === PaymentStatus.FAILED,
  );

// Check payment before changing order status
const CheckOrderPayment = (
  payments: {
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    providerPaymentId: string | null;
  }[],
  orderStatus: OrderStatus,
  actorRole?: UserRole,
) => {
  const hasPaidPayment = payments.some(
    (payment) => payment.paymentStatus === PaymentStatus.PAID,
  );

  const hasBkashPayment = payments.some(
    (payment) => payment.paymentMethod === PaymentMethod.BKASH,
  );

  const hasPendingBkash = payments.some(
    (payment) =>
      payment.paymentMethod === PaymentMethod.BKASH &&
      payment.paymentStatus === PaymentStatus.PENDING,
  );

  if (
    orderStatus === OrderStatus.DELIVERED &&
    !hasPaidPayment &&
    hasPendingBkash
  ) {
    if (actorRole !== UserRole.ADMIN) {
      throw new AppError(
        403,
        "An admin must confirm delivery for a pending bKash payment",
      );
    }

    const pendingPayments = payments.filter(
      (payment) => payment.paymentStatus === PaymentStatus.PENDING,
    );

    if (pendingPayments.length > 1) {
      throw new AppError(
        409,
        "Multiple pending payments require reconciliation",
      );
    }
  }

  if (
    orderStatus === OrderStatus.CONFIRMED &&
    hasBkashPayment &&
    !hasPaidPayment &&
    !(actorRole === UserRole.ADMIN && hasPendingBkash) &&
    !allBkashAttemptsFailed(payments)
  ) {
    throw new AppError(400, "Complete bKash payment before confirming order");
  }

  if (orderStatus === OrderStatus.CANCELLED) {
    if (hasPaidPayment) {
      throw new AppError(
        409,
        "Please process the refund before cancelling order",
      );
    }

    const hasActivePayment = payments.some(
      (payment) =>
        payment.paymentMethod !== PaymentMethod.CASH_ON_DELIVERY &&
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

// 6. Update order status
const UpdateOrderStatus = async (
  orderId: string,
  payload: IUpdateOrderStatusInput,
  actorRole?: UserRole,
) => {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM orders
      WHERE id = ${orderId}
      FOR UPDATE
    `;

    const existingOrder = await tx.order.findUnique({
      where: { id: orderId },

      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        totalAmount: true,

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

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      CONFIRMED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      PREPARING: [OrderStatus.READY, OrderStatus.CANCELLED],
      READY: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
      OUT_FOR_DELIVERY: [OrderStatus.DELIVERED],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (
      !allowedTransitions[existingOrder.orderStatus].includes(
        payload.orderStatus,
      )
    ) {
      throw new AppError(
        400,
        `Cannot change order status from ${existingOrder.orderStatus} to ${payload.orderStatus}`,
      );
    }

    CheckOrderPayment(existingOrder.payments, payload.orderStatus, actorRole);

    // If every bKash attempt failed, collect the order total on delivery.
    if (
      (payload.orderStatus === OrderStatus.CONFIRMED ||
        payload.orderStatus === OrderStatus.DELIVERED) &&
      allBkashAttemptsFailed(existingOrder.payments)
    ) {
      await tx.payment.create({
        data: {
          orderId,
          amount: existingOrder.totalAmount,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.PENDING,
        },
      });
    }

    const order = await tx.order.update({
      where: { id: orderId },
      data: { orderStatus: payload.orderStatus },

      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        updatedAt: true,
      },
    });

    const alreadyPaid = existingOrder.payments.some(
      (payment) => payment.paymentStatus === PaymentStatus.PAID,
    );

    if (order.orderStatus === OrderStatus.DELIVERED && !alreadyPaid) {
      await tx.payment.updateMany({
        where: {
          orderId,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: {
            in:
              actorRole === UserRole.ADMIN
                ? [PaymentMethod.CASH_ON_DELIVERY, PaymentMethod.BKASH]
                : [PaymentMethod.CASH_ON_DELIVERY],
          },
        },

        data: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: order.updatedAt,
          checkoutUrl: null,
        },
      });
    }

    if (payload.orderStatus === OrderStatus.CANCELLED) {
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

// 7. Cancel order
const CancelOrder = async (
  orderId: string,
  userId: string,
  userRole: UserRole,
) => {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM orders
      WHERE id = ${orderId}
      FOR UPDATE
    `;

    const existingOrder = await tx.order.findUnique({
      where: { id: orderId },

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

    if (userRole === UserRole.CUSTOMER && existingOrder.userId !== userId) {
      throw new AppError(403, "You are not allowed to cancel this order");
    }

    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CUSTOMER) {
      throw new AppError(403, "You do not have permission");
    }

    const allowedStatuses: OrderStatus[] =
      userRole === UserRole.ADMIN
        ? [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
          ]
        : [OrderStatus.PENDING, OrderStatus.CONFIRMED];

    if (!allowedStatuses.includes(existingOrder.orderStatus)) {
      throw new AppError(
        400,
        `Order cannot be cancelled from ${existingOrder.orderStatus} status`,
      );
    }

    CheckOrderPayment(existingOrder.payments, OrderStatus.CANCELLED);

    const updatedOrder = await tx.order.updateMany({
      where: {
        id: orderId,
        orderStatus: existingOrder.orderStatus,
      },
      data: { orderStatus: OrderStatus.CANCELLED },
    });

    if (updatedOrder.count === 0) {
      throw new AppError(
        409,
        "Order status changed. Please refresh and try again",
      );
    }

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

    return tx.order.findUnique({
      where: { id: orderId },

      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        updatedAt: true,
      },
    });
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
