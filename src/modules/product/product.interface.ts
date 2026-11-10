export interface ICreateProductInput {
  categoryId: string;
  name: string;
  slug?: string;
  description?: string;
  price: string;
  preparationTime?: number;
}