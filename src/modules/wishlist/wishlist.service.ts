import type { Prisma } from "../../generated/prisma/client.ts";
import { UserRole } from "../../generated/prisma/enums.ts";
import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";

import type {
  ICreateWishlistInput,
  IWishlistQuery,
  IUpdateWishlistStatusInput,
} from "./wishlist.interface.ts";

// 1. Create Wishlist
const CreateWishlist = async (
  payload: ICreateWishlistInput,
  userId?: string,
) => {
  const { foodName, foodDescription, expectedTime } = payload;

  let customerName = payload.customerName;
  let customerPhone = payload.customerPhone;
  let customerEmail = payload.customerEmail;

  // Existing customer
  if (userId) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.isActive) {
      throw new AppError(403, "Your account is disabled");
    }

    if (user.role !== UserRole.CUSTOMER) {
      throw new AppError(403, "Only customers can create a wishlist");
    }

    customerName = user.name;
    customerPhone = user.phone ?? undefined;
    customerEmail = user.email;
  }

  // Guest customer
  if (!userId) {
    if (!customerName || !customerPhone) {
      throw new AppError(400, "Customer name and phone number are required");
    }
  }

  // Check customer name
  if (!customerName) {
    throw new AppError(400, "Customer name is required");
  }

  // Create Wishlist
  const wishlist = await prisma.wishlist.create({
    data: {
      userId: userId ?? null,

      customerName,
      customerPhone: customerPhone ?? null,
      customerEmail: customerEmail ?? null,

      foodName,
      foodDescription,
      expectedTime: new Date(expectedTime),
    },

    select: {
      id: true,
      foodName: true,
      foodDescription: true,
      expectedTime: true,
      status: true,
      createdAt: true,
    },
  });

  return wishlist;
};

// 2. Get All Wishlists (Admin)
const GetAllWishlists = async (query: IWishlistQuery) => {
  const { page, limit, search, status } = query;

  const skip = (page - 1) * limit;

  const where: Prisma.WishlistWhereInput = {
    ...(status && {
      status,
    }),

    ...(search && {
      OR: [
        {
          foodName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerPhone: {
            contains: search,
          },
        },
        {
          customerEmail: {
            contains: search,
            mode: "insensitive",
          },
        },
      ],
    }),
  };

  const [wishlists, totalWishlists] = await prisma.$transaction([
    prisma.wishlist.findMany({
      where,
      skip,
      take: limit,

      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.wishlist.count({
      where,
    }),
  ]);

  return {
    wishlists,

    pagination: {
      totalWishlists,
      currentPage: page,
      totalPages: Math.ceil(totalWishlists / limit),
      limit,
    },
  };
};

// 3. Get Wishlist By ID (Admin)
const GetWishlistById = async (wishlistId: string) => {
  const wishlist = await prisma.wishlist.findUnique({
    where: {
      id: wishlistId,
    },
  });

  if (!wishlist) {
    throw new AppError(404, "Wishlist not found");
  }

  return wishlist;
};

// 4. Update Wishlist Status (Admin)
const UpdateWishlistStatus = async (
  wishlistId: string,
  payload: IUpdateWishlistStatusInput,
) => {
  const existingWishlist = await prisma.wishlist.findUnique({
    where: {
      id: wishlistId,
    },
  });

  if (!existingWishlist) {
    throw new AppError(404, "Wishlist not found");
  }

  const wishlist = await prisma.wishlist.update({
    where: {
      id: wishlistId,
    },

    data: {
      status: payload.status,

      ...(payload.adminNote !== undefined && {
        adminNote: payload.adminNote,
      }),
    },
  });

  return wishlist;
};

export const wishlistService = {
  CreateWishlist,
  GetAllWishlists,
  GetWishlistById,
  UpdateWishlistStatus,
};
