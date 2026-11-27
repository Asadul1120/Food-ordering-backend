import { OtpPurpose, UserRole } from "../../generated/prisma/enums.ts";
import { prisma } from "../../lib/prisma.ts";

import { AppError } from "../../utils/AppError.ts";

import { hashPassword, comparePassword } from "../../utils/password.ts";
import { sendEmail } from "../../utils/sendEmail.ts";
import crypto from "crypto";

import {
  createRefreshToken,
  createToken,
  verifyRefreshToken,
} from "../../utils/token.ts";

import type {
  IRegisterInput,
  ILoginInput,
  IVerifyOtpInput,
} from "./auth.interface.ts";
import { generateOtp, verifyOtp } from "../../utils/otp.utils.ts";

const RegisterUser = async (payload: IRegisterInput) => {
  const { name, phone, email, password } = payload;

  if (phone) {
    const existingPhone = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingPhone) {
      throw new AppError(409, "Phone number already exists");
    }
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingEmail) {
    throw new AppError(409, "Email already exists");
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      phone: phone ?? null,
      email,
      password: hashedPassword,
      role: UserRole.CUSTOMER,
      profile: {
        create: {},
      },
    },

    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,

      profile: true,

      createdAt: true,
    },
  });
  await sendEmail({
    to: user.email,
    subject: "Welcome to Side Kitchen",
    templateName: "welcome-email",
    templateData: {
      name: user.name,
      email: user.email,
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

  if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF) {
    const otpValue = await generateOtp(user.email, OtpPurpose.LOGIN);
    await sendEmail({
      to: user.email,
      subject: "Login for Verify Your Email",
      templateName: "otp-verification",
      templateData: {
        name: user.name,
        email :user.email,
        otp: otpValue,
        expirationMinutes: 5,
      },
    });

    return {
      requiresOtp: true,
      email: user.email,
      message: "OTP verification required",
    };
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(jwtPayload);
  const refreshToken = createRefreshToken(jwtPayload);

  return { accessToken, refreshToken, role: user.role };
};

const verifyLoginOtp = async (payload: IVerifyOtpInput) => {
  const { email, otp } = payload;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(401, "Invalid verification request");
  }

  if (!user.isActive) {
    throw new AppError(403, "Your account is disabled");
  }

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.STAFF) {
    throw new AppError(403, "OTP login is not allowed");
  }

  const isOtpValid = await verifyOtp(user.email, otp, OtpPurpose.LOGIN);

  if (!isOtpValid) {
    throw new AppError(400, "Invalid or expired OTP");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(jwtPayload);
  const refreshToken = createRefreshToken(jwtPayload);

  return {
    accessToken,
    refreshToken,
    role: user.role,
  };
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

      profile: true,

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
  verifyLoginOtp,
  GetCurrentUser,
  refreshToken,
};
