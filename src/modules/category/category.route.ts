import { Router } from "express";
import { categoryController } from "./category.controller.ts";
const router = Router();

router.get("/", categoryController.GetAllCategories);

export const categoryRoutes = router;
