import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAdmin, requirePermission } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  INVEST_SESSION_COOKIE,
  INVEST_SESSION_MAX_AGE_MS,
  signInvestSession,
} from "../../lib/jwt";
import { requireInvestPortal } from "../middleware/portalAuth";
import * as projects from "../services/projectService";
import * as investors from "../services/investorService";
import * as capital from "../services/capitalExpenseService";
import * as settlement from "../services/settlementService";
import * as dash from "../services/dashboardPortal";
import { prisma } from "../../prisma";
import path from "node:path";
import fs from "node:fs";

export const investRouter = Router();

function actor(req: { session?: { userId?: string; email?: string } }) {
  return { id: req.session?.userId, email: req.session?.email };
}

function httpError(err: unknown, res: import("express").Response) {
  const status = (err as { status?: number })?.status ?? 500;
  const message = err instanceof Error ? err.message : "Server error";
  res.status(status).json({ error: message });
}

function requestIsSecure(req: { get: (n: string) => string | undefined; secure?: boolean }) {
  const forwardedProto = String(req.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return forwardedProto === "https" || (!forwardedProto && Boolean(req.secure));
}

// ── Admin API ───────────────────────────────────────────────
const admin = Router();
admin.use(requireAdmin, requirePermission("invest"));

admin.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    res.json(await dash.adminDashboard());
  })
);

admin.get(
  "/projects",
  asyncHandler(async (_req, res) => {
    res.json(await projects.listProjects());
  })
);

admin.post(
  "/projects",
  asyncHandler(async (req, res) => {
    try {
      res.status(201).json(await projects.createProject(req.body ?? {}, actor(req)));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.get(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    try {
      res.json(await projects.getProjectDetail(req.params.id));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.patch(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    try {
      res.json(await projects.updateProject(req.params.id, req.body ?? {}, actor(req)));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.post(
  "/projects/:id/status",
  asyncHandler(async (req, res) => {
    try {
      const status = String(req.body?.status || "");
      res.json(await projects.setProjectStatus(req.params.id, status, req.body?.note, actor(req)));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.post(
  "/projects/:id/members",
  asyncHandler(async (req, res) => {
    try {
      res.status(201).json(await investors.addProjectMember(req.params.id, req.body ?? {}, actor(req)));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.get(
  "/projects/:id/contributions",
  asyncHandler(async (req, res) => {
    res.json(await capital.listContributions(req.params.id));
  })
);

admin.post(
  "/projects/:id/contributions",
  asyncHandler(async (req, res) => {
    try {
      res.status(201).json(await capital.createContribution(req.params.id, req.body ?? {}, actor(req)));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.get(
  "/projects/:id/expenses",
  asyncHandler(async (req, res) => {
    res.json(await capital.listExpenses(req.params.id));
  })
);

admin.post(
  "/projects/:id/expenses",
  asyncHandler(async (req, res) => {
    try {
      res.status(201).json(await capital.createExpense(req.params.id, req.body ?? {}, actor(req)));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.post(
  "/projects/:id/simulate",
  asyncHandler(async (req, res) => {
    try {
      res.json(await projects.simulateProject(req.params.id, req.body ?? {}));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.post(
  "/projects/:id/settlements",
  asyncHandler(async (req, res) => {
    try {
      res.status(201).json(await settlement.createAndPostSettlement(req.params.id, req.body ?? {}, actor(req)));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.get(
  "/projects/:projectId/settlements/:settlementId",
  asyncHandler(async (req, res) => {
    try {
      res.json(await settlement.getSettlement(req.params.projectId, req.params.settlementId));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.post(
  "/expenses/:id/approve",
  asyncHandler(async (req, res) => {
    try {
      res.json(await capital.approveExpense(req.params.id, actor(req), true));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.post(
  "/expenses/:id/reject",
  asyncHandler(async (req, res) => {
    try {
      res.json(await capital.approveExpense(req.params.id, actor(req), false, req.body?.reason));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.get(
  "/investors",
  asyncHandler(async (_req, res) => {
    res.json(await investors.listInvestors());
  })
);

admin.post(
  "/investors",
  asyncHandler(async (req, res) => {
    try {
      res.status(201).json(await investors.createInvestor(req.body ?? {}, actor(req)));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.get(
  "/investors/:id",
  asyncHandler(async (req, res) => {
    try {
      res.json(await investors.getInvestor(req.params.id));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.patch(
  "/investors/:id",
  asyncHandler(async (req, res) => {
    try {
      res.json(await investors.updateInvestor(req.params.id, req.body ?? {}, actor(req)));
    } catch (e) {
      httpError(e, res);
    }
  })
);

admin.get(
  "/documents/:id/download",
  asyncHandler(async (req, res) => {
    const doc = await prisma.invDocument.findUnique({ where: { id: req.params.id } });
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const abs = path.resolve(doc.storageKey);
    if (!fs.existsSync(abs)) {
      res.status(404).json({ error: "File missing" });
      return;
    }
    res.download(abs, doc.name);
  })
);

// ── Investor portal (registered before admin mount so auth is not required) ─
const portalLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts" },
});

investRouter.post(
  "/portal/login",
  portalLoginLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    try {
      const session = await dash.portalLogin(parsed.data.email, parsed.data.password);
      const token = signInvestSession({
        portalUserId: session.id,
        investorId: session.investorId!,
        email: session.email!,
      });
      res.cookie(INVEST_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: requestIsSecure(req),
        sameSite: "lax",
        maxAge: INVEST_SESSION_MAX_AGE_MS,
        path: "/",
      });
      res.json(session);
    } catch (e) {
      httpError(e, res);
    }
  })
);

investRouter.post(
  "/portal/logout",
  asyncHandler(async (_req, res) => {
    res.clearCookie(INVEST_SESSION_COOKIE, { path: "/" });
    res.status(204).end();
  })
);

investRouter.get(
  "/portal/me",
  requireInvestPortal,
  asyncHandler(async (req, res) => {
    res.json({
      id: req.investPortal!.portalUserId,
      email: req.investPortal!.email,
      name: req.investPortal!.name,
      investorId: req.investPortal!.investorId,
    });
  })
);

investRouter.get(
  "/portal/dashboard",
  requireInvestPortal,
  asyncHandler(async (req, res) => {
    res.json(await dash.portalDashboard(req.investPortal!.investorId));
  })
);

investRouter.get(
  "/portal/projects",
  requireInvestPortal,
  asyncHandler(async (req, res) => {
    res.json(await dash.portalProjects(req.investPortal!.investorId));
  })
);

investRouter.get(
  "/portal/projects/:id",
  requireInvestPortal,
  asyncHandler(async (req, res) => {
    try {
      res.json(await dash.portalProject(req.investPortal!.investorId, req.params.id));
    } catch (e) {
      httpError(e, res);
    }
  })
);

// Admin routes last — requireAdmin must not wrap portal endpoints above.
investRouter.use(admin);

// Keep bcrypt import used (portal password set via investor create)
void bcrypt;
