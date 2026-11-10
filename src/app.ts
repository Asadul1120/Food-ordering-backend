import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request, type Response } from "express";

import { config } from "./config/index.ts";
import { globalErrorHandler } from "./middleware/global-error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { authRoutes } from "./modules/auth/auth.route.ts";
import { userRoutes } from "./modules/user/user.route.ts";
import { categoryRoutes } from "./modules/category/category.route.ts";
import { productRoutes } from "./modules/product/product.route.ts";

const app = express();

app.use(cors({ origin: config.frontend_url, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (_req: Request, res: Response) => {
  res.json({ success: true, message: "API is running" });
});

//
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
