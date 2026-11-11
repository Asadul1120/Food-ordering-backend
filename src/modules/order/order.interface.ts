export type TPaymentMethod =
  | "CASH_ON_DELIVERY"
  | "BKASH"
  | "STRIPE"
  | "SSLCOMMERZ";

export interface ICreateOrderItem {
  productId: string;
  quantity: number;
}

export interface ICreateOrderInput {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  orderNote?: string;
  couponCode?: string;
  paymentMethod: TPaymentMethod;
  items: ICreateOrderItem[];
}
