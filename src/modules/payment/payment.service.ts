import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "../../generated/prisma/enums.ts";
import { createBkashPayment, executeBkashPayment, queryBkashPayment } from "../../lib/bkash.ts";
import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";
import { IVerifyPaymentInput } from "./payment.interface.ts";

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



const toMinorUnits = (value: string) => {
  const [whole, fraction = ""] = value.split(".");

  return (
    BigInt(whole) * 100n +
    BigInt((fraction + "00").slice(0, 2))
  );
};

const VerifyPayment = async (
  payload: IVerifyPaymentInput,
  userId?: string,
) => {
  const payment = await prisma.payment.findUnique({
    where: {
      providerPaymentId: payload.paymentID,
    },
    select: {
      id: true,
      amount: true,
      paymentMethod: true,
      paymentStatus: true,
      providerPaymentId: true,
      transactionId: true,
      paidAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          orderStatus: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(404, "Payment not found");
  }

  if (payment.paymentMethod !== PaymentMethod.BKASH) {
    throw new AppError(400, "This is not a bKash payment");
  }

  if (
    payment.order.userId !== null &&
    !userId
  ) {
    throw new AppError(401, "Please login to verify this payment");
  }

  if (
    payment.order.userId !== null &&
    payment.order.userId !== userId
  ) {
    throw new AppError(
      403,
      "You are not allowed to verify this payment",
    );
  }

  if (payment.paymentStatus === PaymentStatus.PAID) {
    return {
      orderId: payment.order.id,
      orderNumber: payment.order.orderNumber,
      paymentStatus: payment.paymentStatus,
      transactionId: payment.transactionId,
      amount: payment.amount,
      paidAt: payment.paidAt,
      alreadyVerified: true,
    };
  }

  if (
    payment.paymentStatus !== PaymentStatus.PENDING
  ) {
    throw new AppError(409, "This payment cannot be verified");
  }

  if (payment.order.orderStatus === OrderStatus.CANCELLED) {
    throw new AppError(409, "Cancelled order cannot be paid");
  }

  let bkashResult;

  try {
    bkashResult = await executeBkashPayment(payload.paymentID);
  } catch (executeError) {
    try {
      bkashResult = await queryBkashPayment(payload.paymentID);
    } catch (queryError) {
      console.error("bKash Execute Error:", executeError);
      console.error("bKash Query Error:", queryError);

      throw new AppError(
        502,
        "Unable to verify bKash payment. Please try again",
      );
    }
  }

  const transactionId = bkashResult.trxID || bkashResult.trxId;

  if (
    bkashResult.statusCode !== "0000" ||
    bkashResult.transactionStatus !== "Completed"
  ) {
    throw new AppError(
      400,
      bkashResult.statusMessage || "bKash payment is not completed",
    );
  }

  if (
    bkashResult.paymentID &&
    bkashResult.paymentID !== payload.paymentID
  ) {
    throw new AppError(400, "Payment ID verification failed");
  }

  if (
    !bkashResult.amount ||
    toMinorUnits(bkashResult.amount) !==
      toMinorUnits(payment.amount.toFixed(2))
  ) {
    throw new AppError(400, "Payment amount verification failed");
  }

  if (bkashResult.currency !== "BDT") {
    throw new AppError(400, "Payment currency verification failed");
  }

  if (bkashResult.intent !== "sale") {
    throw new AppError(400, "Payment intent verification failed");
  }

  if (
    bkashResult.merchantInvoiceNumber !==
    payment.order.orderNumber
  ) {
    throw new AppError(400, "Invoice number verification failed");
  }

  if (!transactionId) {
    throw new AppError(400, "bKash transaction ID is missing");
  }

  const updatedPayment = await prisma.payment.updateMany({
    where: {
      id: payment.id,
      paymentStatus: PaymentStatus.PENDING,
      providerPaymentId: payload.paymentID,
    },
    data: {
      paymentStatus: PaymentStatus.PAID,
      transactionId,
      paymentProvider: "BKASH",
      paidAt: new Date(),
    },
  });

  if (updatedPayment.count === 0) {
    const currentPayment = await prisma.payment.findUnique({
      where: {
        id: payment.id,
      },
    });

    if (currentPayment?.paymentStatus !== PaymentStatus.PAID) {
      throw new AppError(
        409,
        "Payment status changed. Please check again",
      );
    }
  }

  const verifiedPayment = await prisma.payment.findUnique({
    where: {
      id: payment.id,
    },
    select: {
      id: true,
      amount: true,
      paymentStatus: true,
      transactionId: true,
      paidAt: true,
    },
  });

  if (!verifiedPayment) {
    throw new AppError(404, "Payment not found");
  }

  return {
    orderId: payment.order.id,
    orderNumber: payment.order.orderNumber,
    paymentId: verifiedPayment.id,
    paymentStatus: verifiedPayment.paymentStatus,
    transactionId: verifiedPayment.transactionId,
    amount: verifiedPayment.amount,
    paidAt: verifiedPayment.paidAt,
    alreadyVerified: false,
  };
};

export const paymentService = {
  InitiatePayment,
  VerifyPayment,
};
