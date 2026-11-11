import type { RequestHandler } from "express";

import { prisma } from "../lib/prisma.ts";
import { verifyToken } from "../utils/token.ts";
import { AppError } from "../utils/AppError.ts";
import { catchAsync } from "../utils/catchAsync.ts";

export const OptionalAuth: RequestHandler = catchAsync(
  async (req, _res, next) => {
    const cookieToken = req.cookies?.accessToken;

    const authHeader = req.headers.authorization;

    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;

    const token = cookieToken || bearerToken;

    if (!token) {
      return next();
    }

    let decoded;

    try {
      decoded = verifyToken(token);
    } catch {
      throw new AppError(401, "Invalid or expired access token");
    }

    if (typeof decoded === "string" || typeof decoded.userId !== "string") {
      throw new AppError(401, "Invalid access token");
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, "User account is unavailable");
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
    next();
  },
);
