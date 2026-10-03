import type {
  AdminSettings,
  AdminUser,
  AuditLogEntry,
  ContactRequest,
  DashboardData,
  LandCheck,
  Listing,
  MediaItem,
  PresenceInfo,
  PublicSettings,
  StandbyImage,
  Submission,
  SubmissionTracking,
  TeamMember,
  AssistantChatResponse,
} from "./types";

const CLIENT_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

// Server-side (Server Components, build-time data collection) fetches run in a
// bare Node context with no browser/base URL, so a relative path like "/api"
// either fails to parse or hangs — always resolve to an absolute backend URL.
function serverBase() {
  return `${process.env.BACKEND_INTERNAL_URL || "http://localhost:4000"}/api`;
}

const SERVER_FETCH_TIMEOUT_MS = 5000;

async function serverFetch(path: string, options: { revalidate?: number | false } = {}) {
  try {
    return await fetch(`${serverBase()}${path}`, {
      next: { revalidate: options.revalidate ?? 30 },
      signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

export async function getPublicListingsServer(): Promise<Listing[]> {
  const res = await serverFetch("/listings");
  if (!res?.ok) return [];
  return res.json();
}

export async function getPublicListingServer(id: string): Promise<Listing | null> {
  const res = await serverFetch(`/listings/${id}`);
  if (!res?.ok) return null;
  return res.json();
}

export async function getPublicSettingsServer(): Promise<PublicSettings | null> {
  const res = await serverFetch("/settings", { revalidate: 120 });
  if (!res?.ok) return null;
  return res.json();
}

export async function getSubmissionTrackingServer(code: string): Promise<SubmissionTracking | null> {
  const res = await serverFetch(`/submissions/track/${encodeURIComponent(code)}`, { revalidate: 0 });
  if (!res?.ok) return null;
  return res.json();
}

export async function getTeamServer(): Promise<TeamMember[]> {
  const res = await serverFetch("/team", { revalidate: 120 });
  if (!res?.ok) return [];
  return res.json();
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function clientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CLIENT_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || "Request failed", res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    clientFetch<{ email: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => clientFetch<void>("/auth/logout", { method: "POST" }),
  me: () =>
    clientFetch<{ id: string; email: string; name: string; permissions: string[] }>("/auth/me"),

  searchLocations: (query: string) => clientFetch<{ provider: string; results: Array<{ latitude: number; longitude: number; address: string }> }>(`/location/search?q=${encodeURIComponent(query)}`),

  dlsAdministrativeValuePublic: (data: {
    governorate: string;
    directorate: string;
    village: string;
    basin: string;
    neighborhood: string;
    parcelNumber: string;
  }) =>
    clientFetch<{ value: number; currency: "JOD"; unit: "rate"; source: string; sourceUrl: string; retrievedAt: string }>(
      "/submissions/dls-value",
      { method: "POST", body: JSON.stringify(data) }
    ),

  dlsParcelLocationPublic: (data: {
    villageCode: string;
    basinCode: string;
    sectorCode: string;
    parcelNumber: string;
  }) =>
    clientFetch<{
      latitude: number;
      longitude: number;
      rings: [number, number][][];
      dlsKey: string;
      villageCode: string;
      basinCode: string;
      sectorCode: string;
      parcelId: string;
      sheetNo: string | null;
      areaSqm: number | null;
      perimeterM: number | null;
      source: string;
      sourceUrl: string;
    }>("/submissions/dls-location", { method: "POST", body: JSON.stringify(data) }),

  async submitLead(
    data: Record<string, string | undefined>,
    files: { images?: File[]; video?: File; document?: File }
  ): Promise<Submission> {
    const form = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== "") form.append(key, value);
    }
    files.images?.forEach((file) => form.append("images", file));
    if (files.video) form.append("video", files.video);
    if (files.document) form.append("document", files.document);

    const res = await fetch(`${CLIENT_BASE}/submissions`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(body.error || "Request failed", res.status);
    }
    return res.json();
  },

  adminListings: (query?: string) => clientFetch<Listing[]>(`/admin/listings${query ? `?${query}` : ""}`),
  createListing: (data: Record<string, unknown>) =>
    clientFetch<Listing>("/admin/listings", { method: "POST", body: JSON.stringify(data) }),
  updateListing: (id: string, data: Record<string, unknown>) =>
    clientFetch<Listing>(`/admin/listings/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteListing: (id: string) => clientFetch<void>(`/admin/listings/${id}`, { method: "DELETE" }),
  togglePublish: (id: string, publishStatus: string) =>
    clientFetch<Listing>(`/admin/listings/${id}/publish`, { method: "PATCH", body: JSON.stringify({ publishStatus }) }),

  ownerListing: (code: string) => clientFetch<Listing>(`/owner/listings/${encodeURIComponent(code)}`),
  updateOwnerListing: (code: string, data: { status?: string; smsOptIn?: boolean }) =>
    clientFetch<Listing>(`/owner/listings/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteOwnerListing: (code: string, listingNo: string) =>
    clientFetch<void>(`/owner/listings/${encodeURIComponent(code)}?confirm=${encodeURIComponent(listingNo)}`, {
      method: "DELETE",
    }),
  toggleFeature: (id: string, featured: boolean) =>
    clientFetch<Listing>(`/admin/listings/${id}/feature`, { method: "PATCH", body: JSON.stringify({ featured }) }),

  dlsAdministrativeValue: (data: {
    governorate: string;
    directorate: string;
    village: string;
    basin: string;
    neighborhood: string;
    parcelNumber: string;
  }) =>
    clientFetch<{ value: number; currency: "JOD"; unit: "rate"; source: string; sourceUrl: string; retrievedAt: string }>(
      "/admin/dls/administrative-value",
      { method: "POST", body: JSON.stringify(data) }
    ),

  dlsParcelLocation: (data: {
    villageCode: string;
    basinCode: string;
    sectorCode: string;
    parcelNumber: string;
  }) =>
    clientFetch<{
      latitude: number;
      longitude: number;
      rings: [number, number][][];
      dlsKey: string;
      villageCode: string;
      basinCode: string;
      sectorCode: string;
      parcelId: string;
      sheetNo: string | null;
      areaSqm: number | null;
      perimeterM: number | null;
      source: string;
      sourceUrl: string;
    }>("/admin/dls/parcel-location", { method: "POST", body: JSON.stringify(data) }),

  adminSubmissions: (query?: string) => clientFetch<Submission[]>(`/admin/submissions${query ? `?${query}` : ""}`),
  updateSubmission: (id: string, data: Record<string, unknown>) =>
    clientFetch<Submission>(`/admin/submissions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSubmission: (id: string) => clientFetch<void>(`/admin/submissions/${id}`, { method: "DELETE" }),
  approveSubmission: (
    id: string,
    data: {
      publish: boolean;
      includeParcel: boolean;
      includePrice: boolean;
      includeDocument: boolean;
      includeVideo: boolean;
      showEstimatedValue?: boolean;
      imageUrls: string[];
      edits?: {
        title?: string;
        price?: string;
        description?: string;
        phone?: string;
        size?: string;
        village?: string;
        basin?: string;
        neighborhood?: string;
        parcel?: string;
      };
    }
  ) => clientFetch<Listing>(`/admin/submissions/${id}/approve`, { method: "POST", body: JSON.stringify(data) }),

  createLandCheck: (data: Record<string, unknown>) =>
    clientFetch<{ id: string; serialNo: string; createdAt: string }>("/land-checks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  upsertLandCheckDraft: (data: Record<string, unknown>) =>
    clientFetch<{ id?: string; serialNo?: string; isDraft?: boolean; skipped?: boolean }>("/land-checks/draft", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminLandChecks: (params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    const query = qs.toString();
    return clientFetch<LandCheck[]>(`/admin/land-checks${query ? `?${query}` : ""}`);
  },
  updateLandCheck: (id: string, data: { status?: string; adminNotes?: string | null }) =>
    clientFetch<LandCheck>(`/admin/land-checks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLandCheck: (id: string) => clientFetch<{ ok: boolean }>(`/admin/land-checks/${id}`, { method: "DELETE" }),

  createContactRequest: (data: Record<string, unknown>) =>
    clientFetch<{ id: string; serialNo: string; createdAt: string }>("/contact-requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminContactRequests: (params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    const query = qs.toString();
    return clientFetch<ContactRequest[]>(`/admin/contact-requests${query ? `?${query}` : ""}`);
  },
  updateContactRequest: (id: string, data: { status?: string; adminNotes?: string | null }) =>
    clientFetch<ContactRequest>(`/admin/contact-requests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteContactRequest: (id: string) =>
    clientFetch<{ ok: boolean }>(`/admin/contact-requests/${id}`, { method: "DELETE" }),

  async upload(file: File): Promise<{ url: string; kind: "image" | "video" | "document" }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${CLIENT_BASE}/admin/uploads`, { method: "POST", credentials: "include", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(body.error || "Upload failed", res.status);
    }
    return res.json();
  },

  dashboard: () => clientFetch<DashboardData>("/admin/dashboard"),

  adminSettings: () => clientFetch<AdminSettings>("/admin/settings"),
  updateSettings: (data: Partial<AdminSettings>) =>
    clientFetch<AdminSettings>("/admin/settings", { method: "PATCH", body: JSON.stringify(data) }),

  auditLog: (action?: string) => clientFetch<AuditLogEntry[]>(`/admin/audit${action ? `?action=${action}` : ""}`),

  media: () => clientFetch<MediaItem[]>("/admin/media"),
  deleteMedia: (filename: string) => clientFetch<void>(`/admin/media/${encodeURIComponent(filename)}`, { method: "DELETE" }),

  standbyImages: () => clientFetch<StandbyImage[]>("/admin/standby"),
  createStandbyImage: (data: { url: string; title?: string | null }) =>
    clientFetch<StandbyImage>("/admin/standby", { method: "POST", body: JSON.stringify(data) }),
  deleteStandbyImage: (id: string) => clientFetch<void>(`/admin/standby/${id}`, { method: "DELETE" }),

  adminUsers: () => clientFetch<AdminUser[]>("/admin/users"),
  createAdminUser: (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    whatsapp?: string;
    permissions?: string[];
  }) => clientFetch<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(data) }),
  updateAdminUser: (
    id: string,
    data: { name?: string; phone?: string; whatsapp?: string; permissions?: string[] }
  ) => clientFetch<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAdminUser: (id: string) => clientFetch<void>(`/admin/users/${id}`, { method: "DELETE" }),

  recordView: (listingId: string) =>
    fetch(`${CLIENT_BASE}/listings/${listingId}/view`, { method: "POST", credentials: "include" }).catch(() => undefined),
  heartbeat: (path: string) =>
    fetch(`${CLIENT_BASE}/presence/heartbeat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => undefined),
  adminPresence: () => clientFetch<PresenceInfo>("/admin/presence"),

  assistantStatus: () => clientFetch<{ enabled: boolean }>("/assistant/status"),
  assistantChat: (data: { lang: "ar" | "en"; messages: Array<{ role: "user" | "assistant"; content: string }> }) =>
    clientFetch<AssistantChatResponse>("/assistant/chat", { method: "POST", body: JSON.stringify(data) }),
};
