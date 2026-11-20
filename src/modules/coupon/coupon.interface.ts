import type { Prisma } from "../../generated/prisma/client.ts";
import type { DiscountType } from "../../generated/prisma/enums.ts";
import type { ICreateOrderItem } from "../order/order.interface.ts";


type CouponAmount = string | Prisma.Decimal;

export interface ICreateCouponInput {
  code: string;
  description?: string | null;

  discountType: DiscountType;
  discountValue: CouponAmount;
  minOrderAmount?: CouponAmount;
  maxDiscountAmount?: CouponAmount | null;

  usageLimit?: number | null;
  perUserLimit?: number | null;

  startDate: Date;
  expiryDate: Date;
  isActive?: boolean;
}


export type IUpdateCouponInput = Partial<Omit<ICreateCouponInput, "isActive">>;

export interface ICouponQuery {
  page: number;
  limit: number;
  search?: string;
  discountType?: DiscountType;
  isActive?: boolean;
}

export interface IValidateCouponInput {
  code: string;
  items: ICreateOrderItem[];
}