import { Prisma, UserRole } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";

import type {
  IUpdateUserInput,
  IUpdateUserStatusInput,
  IUserQuery,
} from "./user.interface.ts";

const GetAllUsers = async (query: IUserQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;

  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    ...(query.role && {
      role: query.role as UserRole,
    }),

    ...(query.search && {
      OR: [
        {
          name: {
            contains: query.search,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: query.search,
          },
        },
        {
          email: {
            contains: query.search,
            mode: "insensitive",
          },
        },
      ],
    }),
  };

  const [users, totalUsers] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
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
    }),

    prisma.user.count({
      where,
    }),
  ]);

  return {
    users,
    pagination: {
      totalUsers,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      limit,
    },
  };
};

const GetUserById = async (userId: string) => {
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

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return user;
};

const UpdateUser = async (userId: string, payload: IUpdateUserInput) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!existingUser) {
    throw new AppError(404, "User not found");
  }

  if (payload.phone && payload.phone !== existingUser.phone) {
    const existingPhone = await prisma.user.findUnique({
      where: {
        phone: payload.phone,
      },
    });

    if (existingPhone) {
      throw new AppError(409, "Phone number already exists");
    }
  }

  if (
    typeof payload.email === "string" &&
    payload.email !== existingUser.email
  ) {
    const existingEmail = await prisma.user.findUnique({
      where: {
        email: payload.email,
      },
    });

    if (existingEmail) {
      throw new AppError(409, "Email already exists");
    }
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      ...(payload.name !== undefined && {
        name: payload.name,
      }),

      ...(payload.phone !== undefined && {
        phone: payload.phone,
      }),

      ...(payload.email !== undefined && {
        email: payload.email,
      }),

      ...(payload.role !== undefined && {
        role: payload.role,
      }),
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

  return user;
};

const UpdateUserStatus = async (
  userId: string,
  payload: IUpdateUserStatusInput,
) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!existingUser) {
    throw new AppError(404, "User not found");
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      isActive: payload.isActive,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return user;
};

export const userService = {
  GetAllUsers,
  GetUserById,
  UpdateUser,
  UpdateUserStatus,
};
