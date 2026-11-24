import { Router } from "express";

import Auth from "../../middleware/Auth.ts";
import { OptionalAuth } from "../../middleware/OptionalAuth.ts";

import { UserRole } from "../../generated/prisma/enums.ts";

import {
  validateRequest,
} from "../../middleware/validateRequest.ts";

import {
  wishlistController,
} from "./wishlist.controller.ts";

import {
  createWishlistValidationSchema,
  updateWishlistStatusValidationSchema,
} from "./wishlist.validation.ts";

const router = Router();


// Create Wishlist (Customer & Guest)
router.post(
  "/",
  OptionalAuth,
  validateRequest(createWishlistValidationSchema),
  wishlistController.CreateWishlist,
);


// Get All Wishlists (Admin)
router.get(
  "/",
  Auth(UserRole.ADMIN),
  wishlistController.GetAllWishlists,
);


// Get Wishlist By ID (Admin)
router.get(
  "/:id",
  Auth(UserRole.ADMIN),
  wishlistController.GetWishlistById,
);


// Update Wishlist Status (Admin)
router.patch(
  "/:id/status",
  Auth(UserRole.ADMIN),
  validateRequest(updateWishlistStatusValidationSchema),
  wishlistController.UpdateWishlistStatus,
);


export const wishlistRoutes = router;