import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "../../generated/prisma/enums.ts";
import { createBkashPayment } from "../../lib/bkash.ts";
import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";

const InitiatePayment = async (orderId: string, userId?: string) => {
  const payment = await prisma.payment.findFirst({
    where: {
      orderId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      amount: true,
      paymentMethod: true,
      paymentStatus: true,
      providerPaymentId: true,
      checkoutUrl: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          customerPhone: true,
          orderStatus: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(404, "Payment not found for this order");
  }

  if (payment.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
    return {
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      paymentStatus: payment.paymentStatus,
      requiresOnlinePayment: false,
      checkoutUrl: null,
    };
  }

  if (payment.paymentMethod !== PaymentMethod.BKASH) {
    throw new AppError(400, "Unsupported payment method");
  }

  if (payment.order.userId !== null && !userId) {
    throw new AppError(401, "Please login to access this order");
  }

  if (payment.order.userId !== null && payment.order.userId !== userId) {
    throw new AppError(403, "You are not allowed to pay for this order");
  }

  if (payment.order.orderStatus !== OrderStatus.PENDING) {
    throw new AppError(400, "Payment can only be initiated for pending orders");
  }

  if (payment.paymentStatus !== PaymentStatus.PENDING) {
    throw new AppError(409, "This payment is no longer pending");
  }

  if (payment.providerPaymentId && payment.checkoutUrl) {
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
      payerReference: payment.order.customerPhone,
      merchantInvoiceNumber: payment.order.orderNumber,
    });

    await prisma.payment.update({
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
      paymentStatus: payment.paymentStatus,
      requiresOnlinePayment: true,
      checkoutUrl: bkashResult.bkashURL,
    };
  } catch (error) {
    console.error(
      "[bKash InitiatePayment Error]:",
      error instanceof Error ? error.message : error,
    );

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      502,
      "Unable to initiate bKash payment. Please try again",
    );
  }
};

export const paymentService = {
  InitiatePayment,
};
