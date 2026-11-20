import type { Prisma } from "../../generated/prisma/client.ts";
import { AppError } from "../../utils/AppError.ts";
import { toCents, toMoney } from "../../utils/money.ts";
import type { ICreateOrderItem } from "./order.interface.ts";

export const priceCart = async (
  tx: Prisma.TransactionClient,
  items: ICreateOrderItem[],
) => {
  const itemMap = new Map<string, number>();

  // একই product দুবার পাঠালে quantity যোগ হবে।
  for (const item of items) {
    const previousQuantity = itemMap.get(item.productId) ?? 0;
    itemMap.set(item.productId, previousQuantity + item.quantity);
  }

  for (const quantity of itemMap.values()) {
    if (quantity > 99) {
      throw new AppError(400, "Maximum quantity for one product is 99");
    }
  }

  const productIds = [...itemMap.keys()];

  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      price: true,
      isAvailable: true,
      category: { select: { isActive: true } },
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

  const productMap = new Map(products.map((product) => [product.id, product]));
  let subtotalCents = 0n;

  const orderItems = productIds.map((productId) => {
    const product = productMap.get(productId)!;
    const quantity = itemMap.get(productId)!;
    const productPriceCents = toCents(product.price.toFixed(2));
    const itemSubtotalCents = productPriceCents * BigInt(quantity);

    subtotalCents += itemSubtotalCents;

    return {
      productId,
      productName: product.name,
      productPrice: toMoney(productPriceCents),
      quantity,
      subtotal: toMoney(itemSubtotalCents),
    };
  });

  if (subtotalCents > 9999999999n) {
    throw new AppError(400, "Cart total exceeds the maximum order amount");
  }

  const deliveryChargeCents = 0n;

  return { orderItems, subtotalCents, deliveryChargeCents };
};
