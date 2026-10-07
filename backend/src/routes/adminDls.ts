import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { requireAdmin, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { lookupDlsAdministrativeValue, DlsLookupError } from "../lib/dlsAdministrativeValue";
import { lookupDlsParcelByPoint, lookupDlsParcelLocation, DlsParcelLocationError } from "../lib/dlsParcelLocation";
import { westernDigitsString } from "../lib/arabicDigits";

export const adminDlsRouter = Router();
adminDlsRouter.use(requireAdmin);
adminDlsRouter.use(requirePermission("listings", "submissions", "landChecks"));

// Each lookup drives a real headless-browser session against the DLS site —
// keep this modest regardless of who's calling, so we're never mistaken for
// abusive traffic against a government service.
const dlsLookupLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many DLS lookups — please wait a few minutes and try again." },
});

const dlsLocationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many DLS map lookups — please wait a few minutes and try again." },
});

const lookupSchema = z.object({
  governorate: z.string().min(1),
  directorate: z.string().min(1),
  village: z.string().min(1),
  basin: z.string().min(1),
  neighborhood: z.string().min(1),
  parcelNumber: westernDigitsString(z.string().min(1)),
});

const locationSchema = z.object({
  villageCode: westernDigitsString(z.string().min(1)),
  basinCode: westernDigitsString(z.string().min(1)),
  sectorCode: westernDigitsString(z.string().min(1)),
  parcelNumber: westernDigitsString(z.string().min(1)),
});

const pointSchema = z.object({
  latitude: z.coerce.number().finite().gte(-90).lte(90),
  longitude: z.coerce.number().finite().gte(-180).lte(180),
});

adminDlsRouter.post(
  "/administrative-value",
  dlsLookupLimiter,
  asyncHandler(async (req, res) => {
    const input = lookupSchema.parse(req.body);
    try {
      const result = await lookupDlsAdministrativeValue(input);
      if (!result) {
        res.status(404).json({
          error: "No data found for this parcel — please check the parcel or neighborhood number and change it",
        });
        return;
      }
      res.json(result);
    } catch (err) {
      if (err instanceof DlsLookupError) {
        res.status(502).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

adminDlsRouter.post(
  "/parcel-location",
  dlsLocationLimiter,
  asyncHandler(async (req, res) => {
    const input = locationSchema.parse(req.body);
    try {
      const result = await lookupDlsParcelLocation(input);
      if (!result) {
        res.status(404).json({
          error: "No map geometry found for this parcel — please check the land identity values",
        });
        return;
      }
      res.json(result);
    } catch (err) {
      if (err instanceof DlsParcelLocationError) {
        res.status(502).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

adminDlsRouter.post(
  "/parcel-by-point",
  dlsLocationLimiter,
  asyncHandler(async (req, res) => {
    const input = pointSchema.parse(req.body);
    try {
      const result = await lookupDlsParcelByPoint(input);
      if (!result) {
        res.status(404).json({
          error: "No parcel found at this map point — move the pin inside a parcel boundary",
        });
        return;
      }
      res.json(result);
    } catch (err) {
      if (err instanceof DlsParcelLocationError) {
        res.status(502).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);
