export interface ICreateProductInput {
  categoryId: string;
  name: string;
  slug?: string;
  description?: string;
  price: string;
  preparationTime?: number;
}

export interface IProductQuery {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy: "createdAt" | "price" | "name";
  sortOrder: "asc" | "desc";
}

export type IProductCategoryQuery = Omit<IProductQuery, "categoryId">;

export interface IUpdateProductInput {
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  price?: string;
  preparationTime?: number | null;
}

export interface IUpdateProductAvailabilityInput {
  isAvailable: boolean;
}
