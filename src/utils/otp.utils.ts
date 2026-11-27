import crypto from "node:crypto";
import { OtpPurpose } from "../generated/prisma/enums.ts";
import { prisma } from "../lib/prisma.ts";


// Generate OTP
export const generateOtp = async (
  email: string,
  purpose: OtpPurpose
) => {
  const otp = crypto.randomInt(100000, 1000000).toString();

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.otpVerification.upsert({
    where: {
      email_purpose: {
        email,
        purpose,
      },
    },
    update: {
      otp,
      expiresAt,
    },
    create: {
      email,
      otp,
      purpose,
      expiresAt,
    },
  });

  return otp;
};



export const verifyOtp = async (
  email: string,
  otp: string,
  purpose: OtpPurpose
) => {
  const result = await prisma.otpVerification.deleteMany({
    where: {
      email,
      otp,
      purpose,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  return result.count === 1;
};

// Delete expired OTPs
export const deleteExpiredOtps = async () => {
  return prisma.otpVerification.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  });
};