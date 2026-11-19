import { createHash } from "node:crypto";

import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "../../generated/prisma/enums.ts";

import type { Prisma } from "../../generated/prisma/client.ts";

import {
  createBkashPayment,
  executeBkashPayment,
  queryBkashPayment,
} from "../../lib/bkash.ts";

import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";

import type {
  IVerifyPaymentInput,
  IPaymentQuery,
  IUpdatePaymentStatusInput,
  IPaymentAccess,
} from "./payment.interface.ts";

// Common payment fields
const paymentSelect = {
  id: true,
  orderId: true,
  amount: true,
  paymentMethod: true,
  paymentStatus: true,
  transactionId: true,
  paymentProvider: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentSelect;

// Check order owner
const CheckPaymentAccess = (
  order: {
    userId: string | null;
    guestTokenHash: string | null;
  },
  access: IPaymentAccess,
  allowStaff = false,
) => {
  // Admin and Staff access
  if (
    allowStaff &&
    (
      access.userRole === UserRole.ADMIN ||
      access.userRole === UserRole.STAFF
    )
  ) {
    return;
  }

  // Registered customer
  if (order.userId) {
    if (!access.userId) {
      throw new AppError(401, "Please login first");
    }

    if (order.userId !== access.userId) {
      throw new AppError(
        403,
        "You are not allowed to access this order",
      );
    }

    return;
  }

  // Guest customer
  if (!access.guestToken || !order.guestTokenHash) {
    throw new AppError(
      403,
      "Guest payment token is required",
    );
  }

  const tokenHash = createHash("sha256")
    .update(access.guestToken)
    .digest("hex");

  if (tokenHash !== order.guestTokenHash) {
    throw new AppError(403, "Invalid guest payment token");
  }
};

// Lock order during payment operations
const LockOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
) => {
  await tx.$queryRaw`
    SELECT id FROM orders
    WHERE id = ${orderId}
    FOR UPDATE
  `;
};

// Convert amount to minor units
const toMinorUnits = (value: string) => {
  const [whole, fraction = ""] = value.split(".");

  return (
    BigInt(whole) * 100n +
    BigInt((fraction + "00").slice(0, 2))
  );
};

// 1. Initiate Payment
const InitiatePayment = async (
  orderId: string,
  access: IPaymentAccess,
) => {
  return prisma.$transaction(
    async (tx) => {
      await LockOrder(tx, orderId);

      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          guestTokenHash: true,
          customerPhone: true,
          orderStatus: true,

          payments: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });

      if (!order) {
        throw new AppError(404, "Order not found");
      }

      CheckPaymentAccess(order, access);

      let payment = order.payments[0];

      if (!payment) {
        throw new AppError(404, "Payment not found");
      }

      if (order.orderStatus === OrderStatus.CANCELLED) {
        throw new AppError(400, "Order has been cancelled");
      }

      // Cash on Delivery
      if (
        payment.paymentMethod ===
        PaymentMethod.CASH_ON_DELIVERY
      ) {
        return {
          paymentMethod: payment.paymentMethod,
          paymentStatus: payment.paymentStatus,
          requiresOnlinePayment: false,
          checkoutUrl: null,
        };
      }

      // Only bKash is supported for online payment
      if (payment.paymentMethod !== PaymentMethod.BKASH) {
        throw new AppError(
          400,
          "Unsupported payment method",
        );
      }

      if (payment.paymentStatus === PaymentStatus.PAID) {
        throw new AppError(
          409,
          "This order is already paid",
        );
      }

      if (order.orderStatus !== OrderStatus.PENDING) {
        throw new AppError(
          400,
          "Only pending orders can be paid",
        );
      }

      // Create another attempt after a confirmed failure
      if (
        payment.paymentStatus === PaymentStatus.FAILED
      ) {
        const paidPayment = await tx.payment.findFirst({
          where: {
            orderId,
            paymentStatus: PaymentStatus.PAID,
          },
        });

        if (paidPayment) {
          throw new AppError(409, "Order is already paid");
        }

        payment = await tx.payment.create({
          data: {
            orderId,
            amount: payment.amount,
            paymentMethod: PaymentMethod.BKASH,
            paymentStatus: PaymentStatus.PENDING,
          },
        });
      }

      if (
        payment.paymentStatus !== PaymentStatus.PENDING
      ) {
        throw new AppError(
          409,
          "Payment is no longer pending",
        );
      }

      if (payment.amount.lte(0)) {
        throw new AppError(400, "Invalid payment amount");
      }

      // Return existing checkout for an active attempt
      if (
        payment.providerPaymentId &&
        payment.checkoutUrl
      ) {
        return {
          paymentMethod: PaymentMethod.BKASH,
          paymentStatus: payment.paymentStatus,
          requiresOnlinePayment: true,
          checkoutUrl: payment.checkoutUrl,
        };
      }

      try {
        const bkashResult = await createBkashPayment({
          amount: payment.amount.toFixed(2),
          payerReference: order.customerPhone,
          merchantInvoiceNumber: order.orderNumber,
        });

        await tx.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            providerPaymentId: bkashResult.paymentId,
            checkoutUrl: bkashResult.bkashURL,
            paymentProvider: "BKASH",
          },
        });

        return {
          paymentMethod: PaymentMethod.BKASH,
          paymentStatus: PaymentStatus.PENDING,
          requiresOnlinePayment: true,
          checkoutUrl: bkashResult.bkashURL,
        };
      } catch {
        throw new AppError(
          502,
          "Unable to initiate bKash payment",
        );
      }
    },
    {
      timeout: 120000,
    },
  );
};

// 2. Verify bKash Payment
const VerifyPayment = async (
  payload: IVerifyPaymentInput,
) => {
  const existingPayment = await prisma.payment.findUnique({
    where: {
      providerPaymentId: payload.paymentID,
    },
    select: {
      orderId: true,
    },
  });

  if (!existingPayment) {
    throw new AppError(404, "Payment not found");
  }

  return prisma.$transaction(
    async (tx) => {
      await LockOrder(tx, existingPayment.orderId);

      const payment = await tx.payment.findUnique({
        where: {
          providerPaymentId: payload.paymentID,
        },
        include: {
          order: {
            select: {
              orderNumber: true,
              orderStatus: true,
            },
          },
        },
      });

      if (!payment) {
        throw new AppError(404, "Payment not found");
      }

      if (payment.paymentMethod !== PaymentMethod.BKASH) {
        throw new AppError(
          400,
          "This is not a bKash payment",
        );
      }

      // Already verified
      if (payment.paymentStatus === PaymentStatus.PAID) {
        return {
          paymentStatus: payment.paymentStatus,
          alreadyVerified: true,
        };
      }

      // Ignore old failed attempts
      if (payment.paymentStatus === PaymentStatus.FAILED) {
        return {
          paymentStatus: PaymentStatus.FAILED,
          alreadyVerified: false,
        };
      }

      if (
        payment.paymentStatus !== PaymentStatus.PENDING
      ) {
        throw new AppError(
          409,
          "Payment cannot be verified",
        );
      }

      if (
        payment.order.orderStatus ===
        OrderStatus.CANCELLED
      ) {
        throw new AppError(
          409,
          "Order has been cancelled",
        );
      }

      let bkashResult;

      try {
        if (payload.status === "success") {
          // Execute only after successful callback
          try {
            bkashResult = await executeBkashPayment(
              payload.paymentID,
            );
          } catch {
            bkashResult = await queryBkashPayment(
              payload.paymentID,
            );
          }
        } else {
          // For failed/cancelled callback,
          // never execute a new payment
          bkashResult = await queryBkashPayment(
            payload.paymentID,
          );
        }
      } catch {
        throw new AppError(
          502,
          "Unable to verify bKash payment",
        );
      }

      const providerPaymentId =
        bkashResult.paymentID || bkashResult.paymentId;

      if (providerPaymentId !== payload.paymentID) {
        throw new AppError(
          400,
          "Payment ID verification failed",
        );
      }

      // Provider-confirmed unsuccessful payment
      const failedStatuses = [
        "Failed",
        "Cancelled",
        "Expired",
      ];

      if (
        failedStatuses.includes(
          bkashResult.transactionStatus || "",
        )
      ) {
        await tx.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            paymentStatus: PaymentStatus.FAILED,
            checkoutUrl: null,
          },
        });

        return {
          paymentStatus: PaymentStatus.FAILED,
          alreadyVerified: false,
        };
      }

      // Keep uncertain payments pending
      if (
        bkashResult.statusCode !== "0000" ||
        bkashResult.transactionStatus !== "Completed"
      ) {
        return {
          paymentStatus: PaymentStatus.PENDING,
          alreadyVerified: false,
        };
      }

      // Verify amount
      if (
        !bkashResult.amount ||
        !/^\d+(\.\d{1,2})?$/.test(bkashResult.amount) ||
        toMinorUnits(bkashResult.amount) !==
          toMinorUnits(payment.amount.toFixed(2))
      ) {
        throw new AppError(
          400,
          "Payment amount verification failed",
        );
      }

      // Verify currency and intent
      if (bkashResult.currency !== "BDT") {
        throw new AppError(400, "Invalid currency");
      }

      if (bkashResult.intent !== "sale") {
        throw new AppError(400, "Invalid payment intent");
      }

      // Verify invoice
      if (
        bkashResult.merchantInvoiceNumber !==
        payment.order.orderNumber
      ) {
        throw new AppError(
          400,
          "Invoice number verification failed",
        );
      }

      const transactionId =
        bkashResult.trxID || bkashResult.trxId;

      if (!transactionId) {
        throw new AppError(
          400,
          "Transaction ID is missing",
        );
      }

      const anotherPaidPayment = await tx.payment.findFirst({
        where: {
          orderId: payment.orderId,
          paymentStatus: PaymentStatus.PAID,
          id: {
            not: payment.id,
          },
        },
      });

      if (anotherPaidPayment) {
        throw new AppError(
          409,
          "Duplicate payment requires reconciliation",
        );
      }

      // Save successful payment
      const updatedPayment = await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          paymentStatus: PaymentStatus.PAID,
          transactionId,
          paymentProvider: "BKASH",
          paidAt: new Date(),
          checkoutUrl: null,
        },
        select: {
          paymentStatus: true,
        },
      });

      // Confirm order after successful payment
      await tx.order.updateMany({
        where: {
          id: payment.orderId,
          orderStatus: OrderStatus.PENDING,
        },
        data: {
          orderStatus: OrderStatus.CONFIRMED,
        },
      });

      return {
        ...updatedPayment,
        alreadyVerified: false,
      };
    },
    {
      timeout: 120000,
    },
  );
};

// 3. Get payment details by order ID
const GetOrderPayment = async (
  orderId: string,
  access: IPaymentAccess,
) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      guestTokenHash: true,
      orderStatus: true,

      payments: {
        orderBy: {
          createdAt: "desc",
        },
        select: paymentSelect,
      },
    },
  });

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  CheckPaymentAccess(order, access, true);

  if (!order.payments.length) {
    throw new AppError(404, "Payment not found");
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    payments: order.payments,
  };
};

// 4. Get all payments
const GetAllPayments = async (
  query: IPaymentQuery,
) => {
  const {
    page,
    limit,
    search,
    paymentMethod,
    paymentStatus,
  } = query;

  const skip = (page - 1) * limit;

  const where: Prisma.PaymentWhereInput = {
    ...(paymentMethod && {
      paymentMethod,
    }),

    ...(paymentStatus && {
      paymentStatus,
    }),

    ...(search && {
      OR: [
        {
          transactionId: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          order: {
            orderNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          order: {
            customerName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ],
    }),
  };

  const [payments, totalPayments] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,

      orderBy: {
        createdAt: "desc",
      },

      select: {
        ...paymentSelect,

        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            orderStatus: true,
          },
        },
      },
    }),

    prisma.payment.count({
      where,
    }),
  ]);

  return {
    payments,
    pagination: {
      totalPayments,
      currentPage: page,
      totalPages: Math.ceil(totalPayments / limit),
      limit,
    },
  };
};

// 5. Update payment status
const UpdatePaymentStatus = async (
  paymentId: string,
  payload: IUpdatePaymentStatusInput,
) => {
  const existingPayment = await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
    select: {
      orderId: true,
    },
  });

  if (!existingPayment) {
    throw new AppError(404, "Payment not found");
  }

  return prisma.$transaction(async (tx) => {
    await LockOrder(tx, existingPayment.orderId);

    const payment = await tx.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        order: {
          select: {
            orderStatus: true,
          },
        },
      },
    });

    if (!payment) {
      throw new AppError(404, "Payment not found");
    }

    // Online payments cannot be manually changed
    if (
      payment.paymentMethod !==
      PaymentMethod.CASH_ON_DELIVERY
    ) {
      throw new AppError(
        400,
        "Online payment must be verified by the provider",
      );
    }

    // Return existing payment if status is unchanged
    if (
      payment.paymentStatus === payload.paymentStatus
    ) {
      return tx.payment.findUniqueOrThrow({
        where: {
          id: paymentId,
        },
        select: paymentSelect,
      });
    }

    if (payment.paymentStatus !== PaymentStatus.PENDING) {
      throw new AppError(
        400,
        "Only pending COD payments can be updated",
      );
    }

    // Mark COD as PAID after delivery
    if (payload.paymentStatus === PaymentStatus.PAID) {
      if (
        payment.order.orderStatus !== OrderStatus.DELIVERED
      ) {
        throw new AppError(
          400,
          "Order must be delivered before marking payment as paid",
        );
      }
    }

    // Mark COD as FAILED after order cancellation
    else if (
      payload.paymentStatus === PaymentStatus.FAILED
    ) {
      if (
        payment.order.orderStatus !== OrderStatus.CANCELLED
      ) {
        throw new AppError(
          400,
          "Order must be cancelled before marking payment as failed",
        );
      }
    } else {
      throw new AppError(
        400,
        "Invalid payment status transition",
      );
    }

    const updatedPayment = await tx.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        paymentStatus: payload.paymentStatus,

        paidAt:
          payload.paymentStatus === PaymentStatus.PAID
            ? new Date()
            : null,
      },
      select: paymentSelect,
    });

    return updatedPayment;
  });
};

export const paymentService = {
  InitiatePayment,
  VerifyPayment,
  GetOrderPayment,
  GetAllPayments,
  UpdatePaymentStatus,
};