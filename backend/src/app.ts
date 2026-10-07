import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "node:path";
import { authRouter } from "./routes/auth";
import { listingsRouter } from "./routes/listings";
import { adminListingsRouter } from "./routes/adminListings";
import { submissionsRouter } from "./routes/submissions";
import { adminSubmissionsRouter } from "./routes/adminSubmissions";
import { uploadsRouter } from "./routes/uploads";
import { settingsRouter } from "./routes/settings";
import { adminSettingsRouter } from "./routes/adminSettings";
import { adminDashboardRouter } from "./routes/adminDashboard";
import { adminMediaRouter } from "./routes/adminMedia";
import { adminStandbyRouter } from "./routes/adminStandby";
import { adminUsersRouter } from "./routes/adminUsers";
import { adminAuditRouter } from "./routes/adminAudit";
import { adminDlsRouter } from "./routes/adminDls";
import { presenceRouter, adminPresenceRouter } from "./routes/presence";
import { teamRouter } from "./routes/team";
import { locationRouter } from "./routes/location";
import { landChecksRouter } from "./routes/landChecks";
import { adminLandChecksRouter } from "./routes/adminLandChecks";
import { contactRequestsRouter } from "./routes/contactRequests";
import { adminContactRequestsRouter } from "./routes/adminContactRequests";
import { ownerListingsRouter } from "./routes/ownerListings";
import { assistantRouter } from "./routes/assistant";
import { adminAssistantKnowledgeRouter } from "./routes/adminAssistantKnowledge";
import { marketIntelligenceRouter, adminMarketIntelligenceRouter } from "./routes/marketIntelligence";
import { errorHandler } from "./middleware/errorHandler";

/** Internal craft signature (wal8y) — HTTP header only, not public UI copy. */
const DEV_SIGNATURE = "wal8y";

export const app = express();

app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Built-By", DEV_SIGNATURE);
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "../uploads"), {
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  })
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/owner/listings", ownerListingsRouter);
app.use("/api/admin/listings", adminListingsRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/admin/submissions", adminSubmissionsRouter);
app.use("/api/admin/uploads", uploadsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/team", teamRouter);
app.use("/api/location", locationRouter);
app.use("/api/land-checks", landChecksRouter);
app.use("/api/admin/land-checks", adminLandChecksRouter);
app.use("/api/contact-requests", contactRequestsRouter);
app.use("/api/admin/contact-requests", adminContactRequestsRouter);
app.use("/api/admin/settings", adminSettingsRouter);
app.use("/api/admin/assistant-knowledge", adminAssistantKnowledgeRouter);
app.use("/api/admin/dashboard", adminDashboardRouter);
app.use("/api/admin/media", adminMediaRouter);
app.use("/api/admin/standby", adminStandbyRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/admin/audit", adminAuditRouter);
app.use("/api/admin/dls", adminDlsRouter);
app.use("/api/presence", presenceRouter);
app.use("/api/admin/presence", adminPresenceRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/market-intelligence", marketIntelligenceRouter);
app.use("/api/admin/market-intelligence", adminMarketIntelligenceRouter);

app.use(errorHandler);
