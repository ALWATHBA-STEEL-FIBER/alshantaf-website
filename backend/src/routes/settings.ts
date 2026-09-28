import { Router } from "express";
import { getSettings } from "../lib/settings";
import { asyncHandler } from "../lib/asyncHandler";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({
      whatsappNumber: settings.whatsappNumber,
      contactPhone1: settings.contactPhone1,
      contactPhone2: settings.contactPhone2,
      contactEmail: settings.contactEmail,
      facebookUrl: settings.facebookUrl,
      instagramUrl: settings.instagramUrl,
      submissionsEnabled: settings.submissionsEnabled === "true",
      maintenanceBanner: settings.maintenanceBanner,
    });
  })
);
