import { UserRole } from "../../generated/prisma/enums.ts";
import { prisma } from "../../lib/prisma.ts";

import { AppError } from "../../utils/AppError.ts";

import { hashPassword, comparePassword } from "../../utils/password.ts";
import {
  createRefreshToken,
  createToken,
  verifyRefreshToken,
} from "../../utils/token.ts";

import type { IRegisterInput, ILoginInput } from "./auth.interface.ts";

const RegisterUser = async (payload: IRegisterInput) => {
  const { name, phone, email, password } = payload;

  const existingPhone = await prisma.user.findUnique({
    where: {
      phone,
    },
  });

  if (existingPhone) {
    throw new AppError(409, "Phone number already exists");
  }

  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingEmail) {
      throw new AppError(409, "Email already exists");
    }
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      phone,
      email,
      password: hashedPassword,

      role: UserRole.CUSTOMER,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(jwtPayload);
  const refreshToken = createRefreshToken(jwtPayload);

  return { user, accessToken, refreshToken };
};

const LoginUser = async (payload: ILoginInput) => {
  const { email, password } = payload;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new AppError(401, "Invalid email ");
  }

  if (!user.isActive) {
    throw new AppError(403, "Your account is disabled");
  }

  const isPasswordMatched = await comparePassword(password, user.password);

  if (!isPasswordMatched) {
    throw new AppError(401, "Invalid password");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(jwtPayload);
  const refreshToken = createRefreshToken(jwtPayload);

  return { accessToken, refreshToken };
};

const GetCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, "User not found or account disabled");
  }

  return user;
};

const refreshToken = async (refreshToken: string) => {
  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  if (
    typeof decoded === "string" ||
    decoded.tokenType !== "refresh" ||
    typeof decoded.userId !== "string"
  ) {
    throw new AppError(401, "Invalid refresh token");
  }

  const user = await GetCurrentUser(decoded.userId);

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };

  const accessToken = createToken(jwtPayload);

  return accessToken;
};

export const authService = {
  RegisterUser,
  LoginUser,
  GetCurrentUser,
  refreshToken,
};
