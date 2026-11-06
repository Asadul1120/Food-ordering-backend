// import type {  } from "../generated/prisma/browser.js";

import { UserRole } from "../generated/prisma/enums.ts";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        isActive: boolean;
      };
    }
  }
}

export {};
