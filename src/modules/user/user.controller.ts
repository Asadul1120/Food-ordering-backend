import type { RequestHandler } from "express";

import { catchAsync } from "../../utils/catchAsync.ts";
import apiResponse from "../../utils/apiResponse.ts";

import { userService } from "./user.service.ts";

const GetAllUsers: RequestHandler = catchAsync(async (req, res) => {
  const result = await userService.GetAllUsers(req.query);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "Users retrieved successfully",
    data: result,
  });
});

const GetUserById: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await userService.GetUserById(id as string);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "User retrieved successfully",
    data: user,
  });
});

const UpdateUser: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await userService.UpdateUser(id as string, req.body);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "User updated successfully",
    data: user,
  });
});

const UpdateUserStatus: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await userService.UpdateUserStatus(id as string, req.body);

  apiResponse(res, {
    statusCode: 200,
    success: true,
    message: "User status updated successfully",
    data: user,
  });
});

export const userController = {
  GetAllUsers,
  GetUserById,
  UpdateUser,
  UpdateUserStatus,
};
