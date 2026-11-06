import type { RequestHandler } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";
import { authService } from "./auth.service.ts";
import { AppError } from "../../utils/AppError.ts";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite:
    process.env.NODE_ENV === "production"
      ? ("none" as const)
      : ("lax" as const),
  // maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};

const Register: RequestHandler = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.RegisterUser(
    req.body,
  );

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24,
  });

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });

  apiResponse(res, {
    statusCode: 201,
    success: true,
    message: "Registration successful",
    data: {
      user,
      accessToken,
      refreshToken,
    },
  });
});

const Login: RequestHandler = catchAsync(async (req, res) => {
  const { accessToken, refreshToken } = await authService.LoginUser(req.body);

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24,
  });

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Login successful",
    data: { accessToken, refreshToken },
  });
});

const getMe: RequestHandler = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const user = await authService.GetCurrentUser(userId as string);
  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "User information retrieved successfully",
    data: user,
  });
});

const Logout: RequestHandler = (_req, res) => {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logout successful",
  });
};

const refreshToken: RequestHandler = catchAsync(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new AppError(401, "Refresh token not found");
  }

  const accessToken = await authService.refreshToken(refreshToken);

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24,
  });

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Access token refreshed successfully",
    data: {
      accessToken,
    },
  });
});

export const authController = {
  Register,
  Login,
  getMe,
  Logout,
  refreshToken,
};
