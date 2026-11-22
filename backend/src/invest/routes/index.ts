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
import { investAgentRouter } from "../agent/routes";
import { openBuffer } from "../agent/secure";
import { prisma } from "../../prisma";
import path from "node:path";
import fs from "node:fs";

export const investRouter = Router();

function actor(req: { session?: { userId?: string; email?: string } }) {
  return { id: req.session?.userId, email: req.session?.email };
}

function httpError(err: unknown, res: import("express").Response) {
  const e = err as { status?: number; code?: string; duplicates?: unknown };
  // FinanceError carries a code but no HTTP status — it is a validation problem.
  const status = e?.status ?? (e?.code && err instanceof Error && err.name === "FinanceError" ? 400 : 500);
  const message = status >= 500 ? "Server error" : err instanceof Error ? err.message : "Server error";
  if (status >= 500) console.error("[invest]", err);
  res.status(status).json({ error: message, ...(e?.duplicates ? { duplicates: e.duplicates } : {}) });
}

/** Wrap a handler so thrown service errors become JSON responses. */
function h(fn: (req: import("express").Request, res: import("express").Response) => Promise<unknown>) {
  return asyncHandler(async (req, res) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) {
        if (out === undefined) res.status(204).end();
        else res.json(out);
      }
    } catch (e) {
      httpError(e, res);
    }
  });
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
  "/meta",
  h(async () => ({ expenseCategories: capital.EXPENSE_CATEGORIES }))
);

admin.get(
  "/projects",
  h(async (req) => projects.listProjects({ q: String(req.query.q || ""), status: String(req.query.status || "") }))
);

admin.post(
  "/preview",
  h(async (req) => projects.previewDistribution(req.body ?? {}))
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

admin.patch(
  "/projects/:id/members/:investorId",
  h(async (req) => {
    await investors.updateProjectMember(req.params.id, req.params.investorId, req.body ?? {}, actor(req));
    return projects.getProjectDetail(req.params.id);
  })
);

admin.delete(
  "/projects/:id/members/:investorId",
  h(async (req) => {
    await investors.removeProjectMember(req.params.id, req.params.investorId, actor(req));
    return projects.getProjectDetail(req.params.id);
  })
);

admin.post(
  "/contributions/:id/reverse",
  h(async (req) => {
    await capital.reverseContribution(req.params.id, actor(req), req.body?.reason ? String(req.body.reason) : undefined);
    return { ok: true };
  })
);

admin.patch(
  "/contributions/:id",
  h(async (req) => capital.updateContribution(req.params.id, req.body ?? {}, actor(req)))
);

admin.delete(
  "/contributions/:id",
  h(async (req) => {
    await capital.deleteContribution(req.params.id, actor(req), req.query.reason ? String(req.query.reason).slice(0, 500) : undefined);
    return { ok: true };
  })
);

admin.patch(
  "/expenses/:id",
  h(async (req) => capital.updateExpense(req.params.id, req.body ?? {}, actor(req)))
);

admin.delete(
  "/expenses/:id",
  h(async (req) => {
    await capital.deleteExpense(req.params.id, actor(req), req.query.reason ? String(req.query.reason).slice(0, 500) : undefined);
    return { ok: true };
  })
);

admin.post(
  "/expenses/:id/reverse",
  h(async (req) => {
    await capital.reverseExpense(req.params.id, actor(req), req.body?.reason ? String(req.body.reason) : undefined);
    return { ok: true };
  })
);

admin.get(
  "/projects/:id/settlement",
  h(async (req) => ({ settlement: await settlement.latestSettlement(req.params.id) }))
);

admin.post(
  "/projects/:projectId/settlements/:settlementId/payouts/:partnerId",
  h(async (req) =>
    settlement.markPayout(req.params.projectId, req.params.settlementId, req.params.partnerId, req.body ?? {}, actor(req))
  )
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
  "/me/partner",
  h(async (req) => investors.ensureAdminPartner(actor(req)))
);

admin.post(
  "/me/partner",
  h(async (req) => investors.linkAdminPartner(actor(req), String(req.body?.investorId || "")))
);

admin.put(
  "/projects/:id/members/:investorId/initial-payment",
  h(async (req) => {
    await investors.setInitialPayment(req.params.id, req.params.investorId, req.body ?? {}, actor(req));
    return projects.getProjectDetail(req.params.id);
  })
);

admin.get(
  "/investors",
  h(async (req) =>
    investors.listInvestors({
      q: String(req.query.q || ""),
      active: req.query.active ? String(req.query.active) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    })
  )
);

admin.post(
  "/investors/:id/reveal",
  h(async (req) => investors.revealInvestorPii(req.params.id, actor(req)))
);

admin.post(
  "/investors/duplicates",
  h(async (req) => investors.findDuplicates(req.body ?? {}, req.body?.excludeId ? String(req.body.excludeId) : undefined))
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
    if (abs.endsWith(".enc")) {
      // Files uploaded through the assistant are encrypted at rest.
      let plain: Buffer;
      try {
        plain = openBuffer(await fs.promises.readFile(abs));
      } catch {
        res.status(500).json({ error: "تعذّر فك تشفير الملف" });
        return;
      }
      res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(plain);
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
admin.use("/agent", investAgentRouter);
investRouter.use(admin);

// Keep bcrypt import used (portal password set via investor create)
void bcrypt;
