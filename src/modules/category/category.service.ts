import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../utils/AppError.ts";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../utils/cloudinary.ts";
import { ICreateCategoryInput } from "./category.interface.ts";

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

export const categoryService = {
  CreateCategory,
  GetAllCategories,
  GetCategoryById,
};
