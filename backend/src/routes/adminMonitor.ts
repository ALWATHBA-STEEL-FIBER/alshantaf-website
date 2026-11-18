import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import {
  adminSetDeviceName,
  getMonitorDeviceDetail,
  getMonitorSummary,
  listMonitorDevices,
  listMonitorIps,
} from "../lib/siteMonitor";

export const adminMonitorRouter = Router();
adminMonitorRouter.use(requireAdmin);
adminMonitorRouter.use(requirePermission("monitor"));

adminMonitorRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    res.json(await getMonitorSummary());
  })
);

adminMonitorRouter.get(
  "/devices",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const ip = typeof req.query.ip === "string" ? req.query.ip : undefined;
    const namedOnly = req.query.named === "1" || req.query.named === "true";
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    res.json(await listMonitorDevices({ q, ip, namedOnly, limit, offset }));
  })
);

adminMonitorRouter.get(
  "/devices/:id",
  asyncHandler(async (req, res) => {
    const detail = await getMonitorDeviceDetail(String(req.params.id));
    if (!detail) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    res.json(detail);
  })
);

adminMonitorRouter.patch(
  "/devices/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        displayName: z.union([z.string().max(80), z.null()]),
      })
      .parse(req.body ?? {});
    try {
      const device = await adminSetDeviceName(String(req.params.id), body.displayName);
      res.json({ ok: true, device });
    } catch {
      res.status(404).json({ error: "Device not found" });
    }
  })
);

adminMonitorRouter.get(
  "/ips",
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days) || 30;
    const limit = Number(req.query.limit) || 100;
    res.json(await listMonitorIps({ days, limit }));
  })
);
