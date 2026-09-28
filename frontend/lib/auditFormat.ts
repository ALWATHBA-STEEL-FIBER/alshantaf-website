import type { AuditLogEntry } from "./types";
import type { Dictionary } from "./dictionary";

export interface AuditDisplay {
  label: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "danger";
}

function meta(entry: AuditLogEntry, key: string): string {
  const value = entry.metadata?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

const TONE: Record<string, AuditDisplay["tone"]> = {
  "auth.login": "success",
  "auth.login_failed": "danger",
  "listing.create": "success",
  "listing.update": "neutral",
  "listing.delete": "danger",
  "listing.publish": "success",
  "listing.unpublish": "warning",
  "listing.feature": "neutral",
  "listing.unfeature": "neutral",
  "submission.update": "neutral",
  "submission.approve": "success",
  "settings.update": "neutral",
  "admin_user.create": "success",
  "admin_user.delete": "danger",
  "media.delete": "warning",
};

/** Identifies WHICH submission an action targeted, using the village/applicant/parcel snapshot recorded at the time. */
function submissionDetail(entry: AuditLogEntry, t: Dictionary): string {
  const village = meta(entry, "village");
  const applicant = meta(entry, "applicant");
  const parcel = meta(entry, "parcel");
  const who = [village, parcel ? `#${parcel}` : "", applicant].filter(Boolean).join(" · ");
  return who ? `${t.admin.auditFor}: ${who}` : "";
}

export function formatAudit(entry: AuditLogEntry, t: Dictionary): AuditDisplay {
  const tone = TONE[entry.action] ?? "neutral";

  switch (entry.action) {
    case "auth.login":
      return { label: t.admin.auditActions["auth.login"], detail: "", tone };
    case "auth.login_failed":
      return { label: t.admin.auditActions["auth.login_failed"], detail: "", tone };
    case "listing.create":
      return { label: t.admin.auditActions["listing.create"], detail: `${meta(entry, "listingNo")} — ${meta(entry, "title")}`, tone };
    case "listing.update":
      return { label: t.admin.auditActions["listing.update"], detail: "", tone };
    case "listing.delete":
      return { label: t.admin.auditActions["listing.delete"], detail: `${meta(entry, "listingNo")} — ${meta(entry, "title")}`, tone };
    case "listing.publish":
      return { label: t.admin.auditActions["listing.publish"], detail: "", tone };
    case "listing.unpublish":
      return { label: t.admin.auditActions["listing.unpublish"], detail: "", tone };
    case "listing.feature":
      return { label: t.admin.auditActions["listing.feature"], detail: "", tone };
    case "listing.unfeature":
      return { label: t.admin.auditActions["listing.unfeature"], detail: "", tone };
    case "submission.update": {
      const status = meta(entry, "status");
      const statusLabel = status && status in t.admin.tabsSubmissions ? t.admin.tabsSubmissions[status as keyof typeof t.admin.tabsSubmissions] : status;
      const who = submissionDetail(entry, t);
      return { label: t.admin.auditActions["submission.update"], detail: [who, statusLabel && `→ ${statusLabel}`].filter(Boolean).join(" · "), tone };
    }
    case "submission.approve": {
      const label = entry.metadata?.published
        ? t.admin.auditActions["submission.approve_published"]
        : t.admin.auditActions["submission.approve_draft"];
      const who = submissionDetail(entry, t);
      return { label, detail: [who, meta(entry, "listingNo")].filter(Boolean).join(" · "), tone };
    }
    case "settings.update":
      return { label: t.admin.auditActions["settings.update"], detail: "", tone };
    case "admin_user.create":
      return { label: t.admin.auditActions["admin_user.create"], detail: meta(entry, "email"), tone };
    case "admin_user.delete":
      return { label: t.admin.auditActions["admin_user.delete"], detail: meta(entry, "email"), tone };
    case "media.delete":
      return { label: t.admin.auditActions["media.delete"], detail: entry.targetId ?? "", tone };
    case "contact.create":
      return { label: t.admin.auditActions["contact.create"], detail: meta(entry, "serialNo"), tone: "success" };
    case "contact.update":
      return { label: t.admin.auditActions["contact.update"], detail: meta(entry, "serialNo"), tone };
    case "contact.delete":
      return { label: t.admin.auditActions["contact.delete"], detail: meta(entry, "serialNo"), tone: "danger" };
    case "landcheck.create":
      return { label: t.admin.auditActions["landcheck.create"], detail: meta(entry, "serialNo"), tone: "success" };
    case "landcheck.update":
      return { label: t.admin.auditActions["landcheck.update"], detail: meta(entry, "serialNo"), tone };
    case "landcheck.delete":
      return { label: t.admin.auditActions["landcheck.delete"], detail: meta(entry, "serialNo"), tone: "danger" };
    default:
      return { label: entry.action, detail: "", tone };
  }
}

export const TONE_CLASS: Record<AuditDisplay["tone"], string> = {
  neutral: "bg-surface-2 text-ink",
  success: "bg-green/10 text-green",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
};
