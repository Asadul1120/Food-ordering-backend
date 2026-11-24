import type { Prisma } from "../../generated/prisma/client.ts";
import { UserRole } from "../../generated/prisma/enums.ts";
import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";

import type {
  ICreateWishlistInput,
  IWishlistQuery,
  IUpdateWishlistStatusInput,
} from "./wishlist.interface.ts";

const formatCustomerAddress = (
  profile: {
    deliveryAddress: string | null;
    city: string | null;
    area: string | null;
    postalCode: string | null;
  } | null,
) => {
  if (!profile) {
    return null;
  }

  const address = [
    profile.deliveryAddress,
    profile.area,
    profile.city,
    profile.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return address || null;
};

// 1. Create Wishlist
const CreateWishlist = async (
  payload: ICreateWishlistInput,
  userId?: string,
) => {
  let customerName = payload.customerName;
  let customerPhone = payload.customerPhone;
  let customerEmail = payload.customerEmail;

  let customerAddress = payload.customerAddress ?? null;

  // Existing customer
  if (userId) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },

      include: {
        profile: true,
      },
    });

    if (!user || !user.isActive || user.role !== UserRole.CUSTOMER) {
      throw new AppError(403, "Only active customers can submit a wishlist");
    }

    customerName = user.name;
    customerPhone = user.phone ?? undefined;
    customerEmail = user.email;

    // Get address from UserProfile
    customerAddress = formatCustomerAddress(user.profile);
  }

  // Guest customer
  if (!userId) {
    if (!customerName || !customerPhone) {
      throw new AppError(400, "Customer name and phone number are required");
    }

    if (!customerAddress) {
      throw new AppError(400, "Customer address is required");
    }
  }

  if (!customerName) {
    throw new AppError(400, "Customer name is required");
  }

  // Create wishlist
  const wishlist = await prisma.wishlist.create({
    data: {
      userId: userId ?? null,

      customerName,
      customerPhone: customerPhone ?? null,
      customerEmail: customerEmail ?? null,
      customerAddress,

      foodName: payload.foodName,
      foodDescription: payload.foodDescription,
      expectedTime: new Date(payload.expectedTime),
    },

    select: {
      id: true,
      foodName: true,
      foodDescription: true,
      expectedTime: true,
      status: true,
      adminNote: true,
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
const GetWishlistById = async (id: string) => {
  const wishlist = await prisma.wishlist.findUnique({
    where: {
      id,
    },

    include: {
      user: {
        select: {
          profile: {
            select: {
              deliveryAddress: true,
              city: true,
              area: true,
              postalCode: true,
            },
          },
        },
      },
    },
  });

  if (!wishlist) {
    throw new AppError(404, "Wishlist not found");
  }

  const { user, ...wishlistData } = wishlist;

  return {
    ...wishlistData,

    currentProfileAddress: formatCustomerAddress(user?.profile ?? null),
  };
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

const DeleteWishlist = async (id: string) => {
  const result = await prisma.wishlist.deleteMany({
    where: {
      id,
    },
  });

  if (result.count === 0) {
    throw new AppError(404, "Wishlist not found");
  }

  return {
    id,
  };
};

export const wishlistService = {
  CreateWishlist,
  GetAllWishlists,
  GetWishlistById,
  UpdateWishlistStatus,
  DeleteWishlist,
};
