import type { UserRole } from "../../generated/prisma/enums.ts";

export interface IUserQuery {
  page?: string;
  limit?: string;
  search?: string;
  role?: UserRole;
}

export interface IUpdateUserInput {
  name?: string;
  phone?: string;
  email?: string ;
  role?: UserRole;
}

export interface IUpdateUserStatusInput {
  isActive: boolean;
}