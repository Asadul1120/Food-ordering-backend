import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../utils/cloudinary.ts";
import {
  ICreateCategoryInput,
  IUpdateCategoryInput,
} from "./category.interface.ts";

const CreateCategory = async (
  payload: ICreateCategoryInput,
  file?: Express.Multer.File,
) => {
  const { name, description } = payload;

  const slug =
    payload.slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  if (!slug) {
    throw new AppError(400, "Please provide a valid English category slug");
  }

  const existingName = await prisma.category.findUnique({
    where: {
      name,
    },
  });

  if (existingName) {
    throw new AppError(409, "Category name already exists");
  }

  const existingSlug = await prisma.category.findUnique({
    where: {
      slug,
    },
  });

  if (existingSlug) {
    throw new AppError(409, "Category slug already exists");
  }

  let uploadedImage;

  if (file) {
    uploadedImage = await uploadToCloudinary(file, "food-ordering/categories");
  }

  try {
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description || null,
        imageUrl: uploadedImage?.secure_url ?? null,
        imagePublicId: uploadedImage?.public_id ?? null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return category;
  } catch (error) {
    if (uploadedImage?.public_id) {
      await deleteFromCloudinary(uploadedImage.public_id).catch(
        () => undefined,
      );
    }

    throw error;
  }
};

const GetAllCategories = async () => {
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return categories;
};

const GetCategoryById = async (categoryId: string) => {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!category) {
    throw new AppError(404, "Category not found");
  }

  return category;
};

const UpdateCategory = async (
  categoryId: string,
  payload: IUpdateCategoryInput,
  file?: Express.Multer.File,
) => {
  const existingCategory = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
  });

  if (!existingCategory) {
    throw new AppError(404, "Category not found");
  }

  if (Object.keys(payload).length === 0 && !file) {
    throw new AppError(400, "At least one field or image is required");
  }

  let slug = payload.slug;

  if (payload.name && !payload.slug) {
    const generatedSlug = payload.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (generatedSlug) {
      slug = generatedSlug;
    }
  }

  if (payload.name && payload.name !== existingCategory.name) {
    const existingName = await prisma.category.findUnique({
      where: {
        name: payload.name,
      },
    });

    if (existingName) {
      throw new AppError(409, "Category name already exists");
    }
  }

  if (slug && slug !== existingCategory.slug) {
    const existingSlug = await prisma.category.findUnique({
      where: {
        slug,
      },
    });

    if (existingSlug) {
      throw new AppError(409, "Category slug already exists");
    }
  }

  let uploadedImage;

  if (file) {
    uploadedImage = await uploadToCloudinary(file, "food-ordering/categories");
  }

  try {
    const category = await prisma.category.update({
      where: {
        id: categoryId,
      },
      data: {
        ...(payload.name !== undefined && {
          name: payload.name,
        }),

        ...(slug !== undefined && {
          slug,
        }),

        ...(payload.description !== undefined && {
          description: payload.description || null,
        }),

        ...(uploadedImage && {
          imageUrl: uploadedImage.secure_url,
          imagePublicId: uploadedImage.public_id,
        }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (
      uploadedImage &&
      existingCategory.imagePublicId &&
      existingCategory.imagePublicId !== uploadedImage.public_id
    ) {
      await deleteFromCloudinary(existingCategory.imagePublicId).catch(
        (error) => {
          console.error("Old category image deletion failed:", error);
        },
      );
    }

    return category;
  } catch (error) {
    if (uploadedImage?.public_id) {
      await deleteFromCloudinary(uploadedImage.public_id).catch(
        (deleteError) => {
          console.error("New category image cleanup failed:", deleteError);
        },
      );
    }

    throw error;
  }
};

const DeleteCategory = async (categoryId: string) => {
  const existingCategory = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
    select: {
      id: true,
      name: true,
      imagePublicId: true,
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  if (!existingCategory) {
    throw new AppError(404, "Category not found");
  }

  if (existingCategory._count.products > 0) {
    throw new AppError(
      409,
      "Cannot delete category because products are associated with it",
    );
  }

  try {
    await prisma.category.delete({
      where: {
        id: categoryId,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      throw new AppError(
        409,
        "Cannot delete category because products are associated with it",
      );
    }

    throw error;
  }

  if (existingCategory.imagePublicId) {
    await deleteFromCloudinary(existingCategory.imagePublicId).catch(
      (error) => {
        console.error("Category image deletion failed:", error);
      },
    );
  }

  return {
    id: existingCategory.id,
    name: existingCategory.name,
  };
};

export const categoryService = {
  CreateCategory,
  GetAllCategories,
  GetCategoryById,
  UpdateCategory,
  DeleteCategory,
};
