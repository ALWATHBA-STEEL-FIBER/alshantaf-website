import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { hashOrderToken } from "../lib/orderAccess";
import { brandFromHost, brandLetterhead } from "../lib/orderBrand";
import { orderInclude, serializeOrderPublic } from "../lib/orderSerialize";

export const publicOrdersRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please try again later." },
});

publicOrdersRouter.use(limiter);

publicOrdersRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const raw = String(req.params.token || "").trim();
    if (!raw || raw.length < 16 || raw.length > 128) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const host =
      (typeof req.headers["x-forwarded-host"] === "string"
        ? req.headers["x-forwarded-host"].split(",")[0]
        : null) || req.headers.host;
    const hostBrand = brandFromHost(host);

    const tokenHash = hashOrderToken(raw);
    const access = await prisma.orderAccessToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: {
        order: { include: orderInclude },
      },
    });

    if (!access || access.order.status === "void") {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Enforce brand ↔ domain when we can resolve the host
    if (hostBrand && access.order.brand !== hostBrand) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    res.json({
      order: serializeOrderPublic(access.order),
      brand: brandLetterhead(access.order.brand),
    });
  })
);
