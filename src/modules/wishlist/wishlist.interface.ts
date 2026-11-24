import type { WishlistStatus } from "../../generated/prisma/enums.ts";

export interface ICreateWishlistInput {
  foodName: string;
  foodDescription: string;
  expectedTime: string;

  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

export interface IWishlistQuery {
  page: number;
  limit: number;
  search?: string;
  status?: WishlistStatus;
}

export interface IUpdateWishlistStatusInput {
  status: WishlistStatus;
  adminNote?: string;
}
