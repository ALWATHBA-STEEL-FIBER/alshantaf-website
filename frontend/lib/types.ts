export type IndustryType =
  | "lightSpecial"
  | "light"
  | "mediumSpecial"
  | "medium"
  | "industrialCraft"
  | "industrialHeavy"
  | "industrialTransformative"
  | "industrialGeneral"
  | "agriToIndustrial"
  | "technical"
  | "residentialA"
  | "residentialB"
  | "residentialC"
  | "residentialD"
  | "residentialPopular"
  | "residentialHighDensity"
  | "residentialGreen"
  | "greenWithinA"
  | "greenWithinB"
  | "greenWithinC"
  | "greenWithinD"
  | "residentialPrivateA"
  | "residentialPrivateB"
  | "residentialPrivateC"
  | "residentialRural"
  | "residentialAgri"
  | "agriFacilities"
  | "commercialCentral"
  | "commercialShowrooms"
  | "commercialLinear"
  | "commercialOffice"
  | "commercialIndustrial"
  | "commercialNeighborhoodService"
  | "commercialCenter"
  | "commercialOrdinaryA"
  | "commercialOrdinaryB"
  | "commercialOrdinaryC"
  | "commercialWithinD"
  | "commercialLocal"
  | "commercialComplex"
  | "mixedUse"
  | "mixedUseUrban"
  | "mixedUseEntertainment"
  | "commercialOutsideCentral"
  | "commercialOutsideShowrooms"
  | "commercialOutsideLinear"
  | "commercialOutsideLocal";
export type DealType = "sale" | "rent" | "sale_or_rent" | "partnership";
export type PropertyStatus = "available" | "reserved" | "sold" | "rented" | "canceled";
export type PublishStatus = "published" | "draft" | "archived";
export type PresenterRole = "owner" | "presenter" | "broker" | "company" | "other";
export type SubmissionStatus = "pending" | "duplicate_review" | "needs_info" | "approved" | "rejected";
export type LandCheckStatus = "new" | "contacted" | "closed";

export interface Listing {
  id: string;
  listingNo: string;
  title: string;
  area: string;
  propertyType: string | null;
  industryType: IndustryType;
  dealType: DealType;
  size: string | null;
  price: string | null;
  governorate: string | null;
  directorate: string | null;
  village: string | null;
  basin: string | null;
  neighborhood: string | null;
  parcel: string | null;
  locationUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  administrativeValue: number | null;
  administrativeValueSource: string | null;
  administrativeValueAt: string | null;
  phone: string | null;
  status: PropertyStatus;
  publishStatus: PublishStatus;
  featured: boolean;
  presenterRole: PresenterRole | null;
  presenterName: string | null;
  showPresenter: boolean;
  /** When false, public offer hides DLS mid-range (rate × area) estimate. */
  showEstimatedValue: boolean;
  description: string;
  internalNotes: string | null;
  mainImage: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  images: string[];
  video: string | null;
  document: string | null;
  viewCount: number;
  ownerAccessCode?: string | null;
  smsOptIn?: boolean;
  notifiedMilestones?: number[];
}

export interface Submission {
  id: string;
  serialNo: string;
  trackingCode: string;
  source: "owner" | "broker";
  applicant: string;
  phone: string;
  office: string | null;
  whatsapp: string | null;
  email: string | null;
  authExpiry: string | null;
  governorate: string | null;
  directorate: string | null;
  village: string | null;
  basin: string | null;
  parcel: string | null;
  neighborhood: string | null;
  coordinates: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  administrativeValue: number | null;
  administrativeValueSource: string | null;
  administrativeValueAt: string | null;
  dlsKey: string | null;
  area: string | null;
  price: string | null;
  industryType: IndustryType | null;
  activity: string | null;
  details: string;
  images: string[];
  video: string | null;
  document: string | null;
  duplicate: boolean;
  status: SubmissionStatus;
  reviewer: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  convertedListingId: string | null;
}

export interface PublicSettings {
  whatsappNumber: string;
  contactPhone1: string;
  contactPhone2: string;
  contactEmail: string;
  facebookUrl: string;
  instagramUrl: string;
  submissionsEnabled: boolean;
  maintenanceBanner: string;
}

export interface AdminSettings {
  whatsappNumber: string;
  contactPhone1: string;
  contactPhone2: string;
  contactEmail: string;
  facebookUrl: string;
  instagramUrl: string;
  submissionsEnabled: "true" | "false";
  maintenanceBanner: string;
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface SiteViewSeries {
  days: number;
  totalViews: number;
  totalUniques: number;
  points: Array<{ date: string; views: number; uniqueVisitors: number }>;
}

export interface DashboardData {
  listings: { total: number; byPublishStatus: Record<string, number>; byStatus: Record<string, number> };
  submissions: { total: number; byStatus: Record<string, number> };
  landChecks: { total: number; byStatus: Record<string, number> };
  contactRequests: { total: number; byStatus: Record<string, number> };
  storage: { fileCount: number; totalBytes: number };
  recentAudit: AuditLogEntry[];
  siteViews?: {
    day1: SiteViewSeries;
    day7: SiteViewSeries;
    day30: SiteViewSeries;
  };
}

export interface MediaItem {
  filename: string;
  url: string;
  size: number;
  modifiedAt: string | null;
  used: boolean;
}

export interface StandbyImage {
  id: string;
  url: string;
  title: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  permissions: string[];
  createdAt: string;
}

export interface TeamMember {
  name: string;
  phone: string | null;
  whatsapp: string | null;
}

export interface SubmissionTracking {
  serialNo: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  village: string | null;
  convertedListingId: string | null;
}

export interface PresenceInfo {
  count: number;
  paths: Record<string, number>;
}

export interface LandCheck {
  id: string;
  serialNo: string;
  clientKey?: string | null;
  isDraft?: boolean;
  name: string | null;
  phone: string | null;
  email: string | null;
  governorate: string | null;
  directorate: string | null;
  village: string | null;
  basin: string | null;
  neighborhood: string | null;
  parcel: string | null;
  coordinates: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  dlsKey: string | null;
  areaSqm: number | null;
  areaLabel: string | null;
  perimeterM?: number | null;
  administrativeValue: number | null;
  administrativeValueSource: string | null;
  administrativeValueAt: string | null;
  estimatedMedian: number | null;
  industryType: IndustryType | null;
  notes: string | null;
  status: LandCheckStatus;
  adminNotes: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export type ContactRequestStatus = "new" | "contacted" | "closed";

export interface ContactRequest {
  id: string;
  serialNo: string;
  name: string;
  phone: string;
  requestType: string;
  industryType: string | null;
  activityType: string | null;
  details: string;
  status: ContactRequestStatus;
  adminNotes: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AssistantOfferCard {
  id: string;
  listingNo: string;
  title: string;
  area: string;
  price: string | null;
  size: string | null;
  status: string;
  industryType: string;
  dealType: string;
  mainImage: string | null;
  featured: boolean;
  phone: string | null;
  description: string;
}

export interface AssistantServiceCard {
  id: string;
  title: string;
  note: string;
  href: string;
  cta: string;
  external?: boolean;
}

export type AssistantCard =
  | { type: "offer"; offer: AssistantOfferCard }
  | { type: "service"; service: AssistantServiceCard };

export interface AssistantChatResponse {
  reply: string;
  cards: AssistantCard[];
}
