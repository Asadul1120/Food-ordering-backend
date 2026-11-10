export interface ICreateCategoryInput {
  name: string;
  slug?: string;
  description?: string;
}

export interface IUpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
}