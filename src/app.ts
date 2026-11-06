import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request, type Response } from "express";

import { config } from "./config/index.ts";
import { globalErrorHandler } from "./middleware/global-error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { authRoutes } from "./modules/auth/auth.route.ts";

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


app.use(notFound);
app.use(globalErrorHandler);

export default app;
