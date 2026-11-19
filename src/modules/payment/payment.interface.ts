import {
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "../../generated/prisma/enums.ts";

export interface IVerifyPaymentInput {
  paymentID: string;
  status: "success" | "failure" | "cancel";
}

export interface IPaymentQuery {
  page: number;
  limit: number;
  search?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
}

export interface IUpdatePaymentStatusInput {
  paymentStatus: PaymentStatus;
}

export interface IPaymentAccess {
  userId?: string;
  userRole?: UserRole;
  guestToken?: string;
}
