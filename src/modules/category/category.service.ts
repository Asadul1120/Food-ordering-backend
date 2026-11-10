import { prisma } from "../../lib/prisma.ts";

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

export const categoryService = {
  GetAllCategories,
};