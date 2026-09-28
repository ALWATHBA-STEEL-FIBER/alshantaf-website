import { sendSms } from "./sms";

const SITE = () => (process.env.PUBLIC_SITE_URL || "https://alshantaf.com").replace(/\/$/, "");

export const VIEW_MILESTONES = [10, 25, 50, 100, 200, 500] as const;

export function ownerPortalUrl(ownerAccessCode: string): string {
  return `${SITE()}/my-offer/${encodeURIComponent(ownerAccessCode)}`;
}

export function offerPublicUrl(listingId: string): string {
  return `${SITE()}/offers/${listingId}`;
}

/** Arabic-first SMS copy (short, GSM-friendly where possible). */
export function smsPublished(opts: { listingNo: string; ownerAccessCode: string }): string {
  return `الشنتف: تم نشر عرضك ${opts.listingNo}. تابع الحالة والمشاهدات عبر: ${ownerPortalUrl(opts.ownerAccessCode)}`;
}

export function smsViewMilestone(opts: { listingNo: string; views: number; ownerAccessCode: string }): string {
  return `الشنتف: عرضك ${opts.listingNo} وصل إلى ${opts.views} مشاهدة. التفاصيل: ${ownerPortalUrl(opts.ownerAccessCode)}`;
}

export function smsStatusChange(opts: {
  listingNo: string;
  status: "sold" | "canceled";
  ownerAccessCode: string;
}): string {
  const label = opts.status === "sold" ? "مباع" : "ملغى";
  return `الشنتف: تم تحديث عرضك ${opts.listingNo} إلى «${label}». التفاصيل: ${ownerPortalUrl(opts.ownerAccessCode)}`;
}

export async function notifyListingOwner(
  phone: string | null | undefined,
  smsOptIn: boolean,
  message: string
): Promise<boolean> {
  if (!smsOptIn || !phone) return false;
  return sendSms(phone, message);
}
