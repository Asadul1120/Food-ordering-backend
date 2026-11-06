import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import { config } from "../config/index.ts";

export function createToken(payload: object): string {
  return jwt.sign(
    { ...payload, tokenType: "access" },
    config.jwt_access_secret,
    {
      expiresIn: config.jwt_access_expires_in as SignOptions["expiresIn"],
    },
  );
}

export function createRefreshToken(payload: object): string {
  return jwt.sign(
    { ...payload, tokenType: "refresh" },
    config.jwt_refresh_secret,
    {
      expiresIn: config.jwt_refresh_expires_in as SignOptions["expiresIn"],
    },
  );
}

export function verifyToken(token: string): string | JwtPayload {
  return jwt.verify(token, config.jwt_access_secret);
}

export function verifyRefreshToken(token: string): string | JwtPayload {
  return jwt.verify(token, config.jwt_refresh_secret);
}
