import { prisma } from "../../lib/prisma.ts";

import { AppError } from "../../utils/AppError.ts";

import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../utils/cloudinary.ts";

import type {
  ICreateProductInput,
  IProductQuery,
} from "./product.interface.ts";

const CreateProduct = async (
  payload: ICreateProductInput,
  file?: Express.Multer.File,
) => {
  const { categoryId, name, description, price, preparationTime } = payload;

  if (!file) {
    throw new AppError(400, "Product image is required");
  }

  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!category) {
    throw new AppError(404, "Active category not found");
  }

  const slug =
    payload.slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  if (!slug) {
    throw new AppError(400, "Please provide a valid English product slug");
  }

  const existingSlug = await prisma.product.findUnique({
    where: {
      slug,
    },
  });

  if (existingSlug) {
    throw new AppError(409, "Product slug already exists");
  }

  const uploadedImage = await uploadToCloudinary(
    file,
    "food-ordering/products",
  );

  try {
    const product = await prisma.product.create({
      data: {
        categoryId,
        name,
        slug,
        description: description || null,
        price,
        preparationTime: preparationTime ?? null,
        imageUrl: uploadedImage.secure_url,
        imagePublicId: uploadedImage.public_id,
      },
      select: {
        id: true,
        categoryId: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        imageUrl: true,
        isAvailable: true,
        isFeatured: true,
        preparationTime: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return product;
  } catch (error) {
    await deleteFromCloudinary(uploadedImage.public_id).catch((deleteError) => {
      console.error("Product image cleanup failed:", deleteError);
    });

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AppError(409, "Product slug already exists");
    }

    throw error;
  }
};

const GetAllProducts = async (query: IProductQuery) => {
  const {
    page,
    limit,
    search,
    categoryId,
    minPrice,
    maxPrice,
    sortBy,
    sortOrder,
  } = query;

  const skip = (page - 1) * limit;

  const priceFilter = {
    ...(minPrice !== undefined && {
      gte: minPrice,
    }),

    ...(maxPrice !== undefined && {
      lte: maxPrice,
    }),
  };

  const where = {
    isAvailable: true,

    category: {
      isActive: true,
    },

    ...(categoryId && {
      categoryId,
    }),

    ...(search && {
      OR: [
        {
          name: {
            contains: search,
            mode: "insensitive" as const,
          },
        },
        {
          slug: {
            contains: search,
            mode: "insensitive" as const,
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive" as const,
          },
        },
      ],
    }),

    ...(Object.keys(priceFilter).length > 0 && {
      price: priceFilter,
    }),
  };

  const orderBy =
    sortBy === "price"
      ? { price: sortOrder }
      : sortBy === "name"
        ? { name: sortOrder }
        : { createdAt: sortOrder };

  const [products, totalProducts] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        categoryId: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        imageUrl: true,
        isAvailable: true,
        isFeatured: true,
        preparationTime: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),

    prisma.product.count({
      where,
    }),
  ]);

  return {
    products,
    pagination: {
      totalProducts,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      limit,
    },
  };
};

export const productService = {
  CreateProduct,
  GetAllProducts,
};
