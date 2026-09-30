import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requirePermission } from "../middleware/auth";
import { getSettings, setSettings } from "../lib/settings";
import { audit } from "../lib/audit";
import { asyncHandler } from "../lib/asyncHandler";
import { westernDigitsString } from "../lib/arabicDigits";

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAdmin);
adminSettingsRouter.use(requirePermission("settings"));

adminSettingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await getSettings());
  })
);

const patchSchema = z.object({
  whatsappNumber: westernDigitsString(z.string().min(6).optional()),
  contactPhone1: westernDigitsString(z.string().min(6).optional()),
  contactPhone2: westernDigitsString(z.string().min(6).optional()),
  contactEmail: z.string().email().optional(),
  facebookUrl: z.string().url().optional().or(z.literal("")),
  instagramUrl: z.string().url().optional().or(z.literal("")),
  submissionsEnabled: z.enum(["true", "false"]).optional(),
  maintenanceBanner: z.string().max(300).optional(),
});

adminSettingsRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const patch = patchSchema.parse(req.body);
    const before = await getSettings();
    const after = await setSettings(patch);
    await audit({
      actorEmail: req.session!.email,
      action: "settings.update",
      metadata: { before, after },
      ip: req.ip,
    });
    res.json(after);
  })
);
