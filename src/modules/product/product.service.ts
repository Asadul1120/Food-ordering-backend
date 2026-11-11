import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../utils/cloudinary.ts";

import type {
  ICreateProductInput,
  IProductCategoryQuery,
  IProductQuery,
  IUpdateProductAvailabilityInput,
  IUpdateProductFeaturedInput,
  IUpdateProductInput,
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

const GetProductById = async (productId: string) => {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      isAvailable: true,
      category: {
        isActive: true,
      },
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
          slug: true,
        },
      },
    },
  });

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  return product;
};

const GetFeaturedProducts = async () => {
  const products = await prisma.product.findMany({
    where: {
      isFeatured: true,
      isAvailable: true,
      category: {
        isActive: true,
      },
    },
    orderBy: {
      createdAt: "desc",
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
          slug: true,
        },
      },
    },
  });

  return products;
};

const GetProductsByCategory = async (
  categoryId: string,
  query: IProductCategoryQuery,
) => {
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
    throw new AppError(404, "Category not found");
  }

  const result = await GetAllProducts({
    ...query,
    categoryId,
  });

  return result;
};

const UpdateProduct = async (
  productId: string,
  payload: IUpdateProductInput,
  file?: Express.Multer.File,
) => {
  const existingProduct = await prisma.product.findUnique({
    where: {
      id: productId,
    },
  });

  if (!existingProduct) {
    throw new AppError(404, "Product not found");
  }

  if (Object.keys(payload).length === 0 && !file) {
    throw new AppError(400, "At least one field or image is required");
  }

  if (payload.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: payload.categoryId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new AppError(404, "Active category not found");
    }
  }

  let slug = payload.slug;

  if (payload.name && !payload.slug) {
    slug = payload.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug) {
      throw new AppError(400, "Please provide a valid English product slug");
    }
  }

  if (slug && slug !== existingProduct.slug) {
    const existingSlug = await prisma.product.findUnique({
      where: {
        slug,
      },
    });

    if (existingSlug) {
      throw new AppError(409, "Product slug already exists");
    }
  }

  let uploadedImage;

  if (file) {
    uploadedImage = await uploadToCloudinary(file, "food-ordering/products");
  }

  let product;

  try {
    product = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        ...(payload.categoryId !== undefined && {
          categoryId: payload.categoryId,
        }),

        ...(payload.name !== undefined && {
          name: payload.name,
        }),

        ...(slug !== undefined && {
          slug,
        }),

        ...(payload.description !== undefined && {
          description: payload.description,
        }),

        ...(payload.price !== undefined && {
          price: payload.price,
        }),

        ...(payload.preparationTime !== undefined && {
          preparationTime: payload.preparationTime,
        }),

        ...(uploadedImage && {
          imageUrl: uploadedImage.secure_url,
          imagePublicId: uploadedImage.public_id,
        }),
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
            slug: true,
          },
        },
      },
    });
  } catch (error) {
    if (uploadedImage?.public_id) {
      await deleteFromCloudinary(uploadedImage.public_id).catch(
        (deleteError) => {
          console.error("New product image cleanup failed:", deleteError);
        },
      );
    }

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

  if (
    uploadedImage &&
    existingProduct.imagePublicId &&
    existingProduct.imagePublicId !== uploadedImage.public_id
  ) {
    await deleteFromCloudinary(existingProduct.imagePublicId).catch((error) => {
      console.error("Old product image deletion failed:", error);
    });
  }

  return product;
};

const UpdateProductAvailability = async (
  productId: string,
  payload: IUpdateProductAvailabilityInput,
) => {
  const existingProduct = await prisma.product.findUnique({
    where: {
      id: productId,
    },
  });

  if (!existingProduct) {
    throw new AppError(404, "Product not found");
  }

  const product = await prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      isAvailable: payload.isAvailable,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isAvailable: true,
      updatedAt: true,
    },
  });

  return product;
};

const UpdateProductFeatured = async (
  productId: string,
  payload: IUpdateProductFeaturedInput,
) => {
  const existingProduct = await prisma.product.findUnique({
    where: {
      id: productId,
    },
  });

  if (!existingProduct) {
    throw new AppError(404, "Product not found");
  }

  const product = await prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      isFeatured: payload.isFeatured,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isAvailable: true,
      isFeatured: true,
      updatedAt: true,
    },
  });

  return product;
};

export const productService = {
  CreateProduct,
  GetAllProducts,
  GetProductById,
  GetFeaturedProducts,
  GetProductsByCategory,
  UpdateProduct,
  UpdateProductAvailability,
  UpdateProductFeatured,
};
