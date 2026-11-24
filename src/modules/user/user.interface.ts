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
  email?: string;
  role?: UserRole;
}

export interface IUpdateUserStatusInput {
  isActive: boolean;
}

export interface IUpdateMyProfileInput {
  name?: string;
  phone?: string;

  deliveryAddress?: string | null;
  city?: string | null;
  area?: string | null;
  postalCode?: string | null;
}


export interface IChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
