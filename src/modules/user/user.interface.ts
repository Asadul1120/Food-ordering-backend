export interface IUserQuery {
  page?: string;
  limit?: string;
  search?: string;
  role?: "ADMIN" | "STAFF" | "CUSTOMER";
}