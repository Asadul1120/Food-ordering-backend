import dotenv from "dotenv";

dotenv.config();

export const config = {
  node_env: process.env.NODE_ENV,
  port: Number(process.env.PORT ?? 5000),
  database_url: process.env.DATABASE_URL,
  frontend_url: process.env.FRONTEND_URL,
  backend_url: process.env.BACKEND_URL,

  bcrypt_salt: Number(process.env.BCRYPT_SALT_ROUNDS!),

  jwt_access_secret: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET!,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? "7d",
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,
};
