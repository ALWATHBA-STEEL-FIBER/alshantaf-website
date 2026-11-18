import type {
  AdminAiConfig,
  AdminAiConfigPatch,
  AdminSettings,
  AdminUser,
  AuditLogEntry,
  ContactRequest,
  CustomerOrder,
  DashboardData,
  PublicOrderPayload,
  LandCheck,
  Listing,
  MediaItem,
  MonitorSummary,
  PresenceInfo,
  PublicSettings,
  SiteDevice,
  SiteDeviceEvent,
  SiteDailyRecord,
  SiteEngineer,
  SiteProject,
  SiteProjectSummary,
  SiteDayPayload,
  SiteWeekSheet,
  SiteExcelPreview,
  SiteProjectDetail,
  SiteWeekPayoutSheet,
  SiteWorker,
  SiteWorkerDetail,
  SiteExpense,
  SiteExpenseInput,
  SiteExpenseMeta,
  SiteExpenseOverview,
  SiteProjectCostSummary,
  SiteExpenseSummary,
  SiteEngineerExpenseSummary,
  SiteExpenseCategory,
  StandbyImage,
  Submission,
  SubmissionTracking,
  TeamMember,
  AssistantChatResponse,
} from "./types";

type BotPayload = {
  captchaId?: string;
  captchaAnswer?: string;
  turnstileToken?: string;
  website?: string;
};

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

async function safeJson<T>(res: Response | null, fallback: T): Promise<T> {
  if (!res?.ok) return fallback;
  try {
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function getPublicListingsServer(): Promise<Listing[]> {
  return safeJson(await serverFetch("/listings"), []);
}

export async function getPublicListingServer(id: string): Promise<Listing | null> {
  return safeJson(await serverFetch(`/listings/${id}`), null);
}

export async function getPublicSettingsServer(): Promise<PublicSettings | null> {
  return safeJson(await serverFetch("/settings", { revalidate: 120 }), null);
}

export async function getSubmissionTrackingServer(code: string): Promise<SubmissionTracking | null> {
  return safeJson(
    await serverFetch(`/submissions/track/${encodeURIComponent(code)}`, { revalidate: 0 }),
    null
  );
}

export async function getTeamServer(): Promise<TeamMember[]> {
  return safeJson(await serverFetch("/team", { revalidate: 120 }), []);
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

/** Stay under Cloudflare's 100MB request cap by posting the file in small pieces. */
async function uploadAdminVideoInChunks(
  file: File,
  onProgress?: (done: number, total: number, phase: "upload" | "convert") => void
): Promise<{ url: string; kind: "video" }> {
  const chunkSize = 8 * 1024 * 1024;
  const total = Math.max(1, Math.ceil(file.size / chunkSize));
  const uploadId = crypto.randomUUID();
  for (let index = 0; index < total; index++) {
    const blob = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
    const form = new FormData();
    form.append("uploadId", uploadId);
    form.append("index", String(index));
    form.append("total", String(total));
    form.append("filename", file.name || "video.mp4");
    form.append("chunk", blob, file.name || "video.mp4");
    const res = await fetch(`${CLIENT_BASE}/admin/uploads/video-chunk`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText || "Upload failed" }));
      throw new ApiError(body.error || "Upload failed", res.status);
    }
    onProgress?.(index + 1, total, "upload");
  }
  onProgress?.(total, total, "convert");
  const started = await clientFetch<{ status: string; url?: string }>("/admin/uploads/video-finish", {
    method: "POST",
    body: JSON.stringify({ uploadId }),
  });
  if (started.status === "done" && started.url) return { url: started.url, kind: "video" };
  for (let attempt = 0; attempt < 300; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const statusRes = await fetch(
      `${CLIENT_BASE}/admin/uploads/video-status?uploadId=${encodeURIComponent(uploadId)}&t=${Date.now()}`,
      {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      }
    );
    // Safari revalidates this GET and can surface 304 with an empty body.
    if (statusRes.status === 304) continue;
    const status = (await statusRes.json().catch(() => null)) as { status?: string; url?: string; error?: string } | null;
    if (!statusRes.ok) throw new ApiError(status?.error || "Upload failed", statusRes.status);
    if (status?.status === "done" && status.url) return { url: status.url, kind: "video" };
  }
  throw new ApiError("Video conversion timed out", 504);
}

export const api = {
  login: (email: string, password: string, bot?: Record<string, string | undefined>) =>
    clientFetch<{ email: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(bot || {}) }),
    }),
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
      adjacentRoads: Array<{
        id: string;
        name: string;
        side: "north" | "south" | "east" | "west";
        widthM: number | null;
        source: "osm-overpass" | "google-maps" | "dls-neighbor";
        path: [number, number][];
      }>;
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

  dlsParcelByPointPublic: (data: { latitude: number; longitude: number }) =>
    clientFetch<{
      latitude: number;
      longitude: number;
      rings: [number, number][][];
      adjacentRoads: Array<{
        id: string;
        name: string;
        side: "north" | "south" | "east" | "west";
        widthM: number | null;
        source: "osm-overpass" | "google-maps" | "dls-neighbor";
        path: [number, number][];
      }>;
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
    }>("/submissions/dls-location-by-point", { method: "POST", body: JSON.stringify(data) }),

  ammanZoningPublic: (data: {
    latitude?: number;
    longitude?: number;
    villageCode?: string;
    basinCode?: string;
    sectorCode?: string;
    parcelNumber?: string;
  }) =>
    clientFetch<{
      industryType: string | null;
      zoningNo: string | null;
      zoningName: string | null;
      districtName: string | null;
      sourceUrl: string;
      latitude: number | null;
      longitude: number | null;
    }>("/submissions/amman-zoning", { method: "POST", body: JSON.stringify(data) }),
  industryTypesCatalogPublic: () =>
    clientFetch<
      Array<{
        industryType: string;
        category: string;
        ammanAutoEligible: boolean;
        rules: {
          setbacks: {
            frontal: string;
            side: string;
            rear: string;
            buildPercentage: string;
            floors: string;
            height: string;
          };
        };
        createdAt: string;
        updatedAt: string;
      }>
    >("/submissions/industry-types-catalog"),

  async submitLead(
    data: Record<string, string | undefined>,
    files: { images?: File[]; video?: File; document?: File },
    bot?: Record<string, string | undefined>
  ): Promise<Submission> {
    const form = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== "") form.append(key, value);
    }
    if (bot) {
      for (const [key, value] of Object.entries(bot)) {
        if (value !== undefined) form.append(key, value);
      }
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
      adjacentRoads: Array<{
        id: string;
        name: string;
        side: "north" | "south" | "east" | "west";
        widthM: number | null;
        source: "osm-overpass" | "google-maps" | "dls-neighbor";
        path: [number, number][];
      }>;
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

  dlsParcelByPoint: (data: { latitude: number; longitude: number }) =>
    clientFetch<{
      latitude: number;
      longitude: number;
      rings: [number, number][][];
      adjacentRoads: Array<{
        id: string;
        name: string;
        side: "north" | "south" | "east" | "west";
        widthM: number | null;
        source: "osm-overpass" | "google-maps" | "dls-neighbor";
        path: [number, number][];
      }>;
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
    }>("/admin/dls/parcel-by-point", { method: "POST", body: JSON.stringify(data) }),

  adminSubmissions: (query?: string) => clientFetch<Submission[]>(`/admin/submissions${query ? `?${query}` : ""}`),
  updateSubmission: (id: string, data: Record<string, unknown>) =>
    clientFetch<Submission>(`/admin/submissions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
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

  adminOrders: (params?: { status?: string; kind?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.kind) qs.set("kind", params.kind);
    if (params?.q) qs.set("q", params.q);
    const query = qs.toString();
    return clientFetch<CustomerOrder[]>(`/admin/orders${query ? `?${query}` : ""}`);
  },
  adminOrder: (id: string) => clientFetch<CustomerOrder>(`/admin/orders/${id}`),
  createOrder: (data: Record<string, unknown>) =>
    clientFetch<{ order: CustomerOrder; shareUrl: string; token: string }>("/admin/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateOrder: (id: string, data: Record<string, unknown>) =>
    clientFetch<CustomerOrder>(`/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  addOrderPayment: (id: string, data: Record<string, unknown>) =>
    clientFetch<CustomerOrder>(`/admin/orders/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  payOrderInstallment: (orderId: string, installmentId: string) =>
    clientFetch<CustomerOrder>(`/admin/orders/${orderId}/installments/${installmentId}/pay`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  rotateOrderToken: (id: string) =>
    clientFetch<{ order: CustomerOrder; shareUrl: string; token: string }>(
      `/admin/orders/${id}/rotate-token`,
      { method: "POST", body: JSON.stringify({}) }
    ),
  publicOrder: (token: string) =>
    clientFetch<PublicOrderPayload>(`/public/orders/${encodeURIComponent(token)}`),

  async upload(
    file: File,
    opts?: { asVideo?: boolean; onProgress?: (done: number, total: number, phase: "upload" | "convert") => void }
  ): Promise<{ url: string; kind: "image" | "video" | "document" }> {
    if (opts?.asVideo) return uploadAdminVideoInChunks(file, opts.onProgress);
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
  assistantKnowledge: () =>
    clientFetch<{ content: string; defaultLength: number; maxChars: number }>("/admin/assistant-knowledge"),
  updateAssistantKnowledge: (content: string) =>
    clientFetch<{ content: string; defaultLength: number; maxChars: number }>("/admin/assistant-knowledge", {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  resetAssistantKnowledge: () =>
    clientFetch<{ content: string; defaultLength: number; maxChars: number }>("/admin/assistant-knowledge/reset", {
      method: "POST",
    }),
  aiConfig: () => clientFetch<AdminAiConfig>("/admin/ai-config"),
  updateAiConfig: (data: AdminAiConfigPatch) =>
    clientFetch<AdminAiConfig>("/admin/ai-config", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

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
  heartbeat: (data: {
    path: string;
    platform?: string | null;
    screen?: string | null;
    timezone?: string | null;
    language?: string | null;
    name?: string | null;
  }) =>
    fetch(`${CLIENT_BASE}/presence/heartbeat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      keepalive: true,
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json().catch(() => null)) as {
          ok: boolean;
          named: boolean;
          displayName: string | null;
          nameLocked: boolean;
        } | null;
      })
      .catch(() => null),
  presenceMe: () =>
    fetch(`${CLIENT_BASE}/presence/me`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json().catch(() => null)) as {
          ok: boolean;
          named: boolean;
          displayName: string | null;
          nameLocked: boolean;
        } | null;
      })
      .catch(() => null),
  adminPresence: () => clientFetch<PresenceInfo>("/admin/presence"),
  monitorSummary: () => clientFetch<MonitorSummary>("/admin/monitor/summary"),
  monitorDevices: (params?: { q?: string; ip?: string; named?: boolean; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.ip) qs.set("ip", params.ip);
    if (params?.named) qs.set("named", "1");
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const suffix = qs.toString() ? `?${qs}` : "";
    return clientFetch<{ total: number; limit: number; offset: number; devices: SiteDevice[] }>(
      `/admin/monitor/devices${suffix}`
    );
  },
  monitorDevice: (id: string) =>
    clientFetch<{
      device: SiteDevice;
      events: SiteDeviceEvent[];
      siblingDevices: Array<{
        id: string;
        displayName: string | null;
        visitorId: string;
        lastSeenAt: string;
        requestCount: number;
        lastPath: string;
      }>;
    }>(`/admin/monitor/devices/${encodeURIComponent(id)}`),
  monitorSetDeviceName: (id: string, displayName: string | null) =>
    clientFetch<{ ok: boolean; device: SiteDevice }>(`/admin/monitor/devices/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName }),
    }),
  monitorIps: (days = 30) =>
    clientFetch<{
      days: number;
      totalUniqueIps: number;
      ips: Array<{ ip: string; hits: number; devices: number; days: number; lastDay: string }>;
    }>(`/admin/monitor/ips?days=${days}`),

  assistantStatus: () => clientFetch<{ enabled: boolean }>("/assistant/status"),
  publicListing: (id: string) => clientFetch<Listing>(`/listings/${encodeURIComponent(id)}`),
  assistantChat: (data: {
    lang: "ar" | "en";
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    context?: {
      offer?: {
        id: string;
        listingNo: string;
        title: string;
        area: string;
        industryType: string;
        dealType: string;
        status: string;
        size?: string | null;
        price?: string | null;
        description?: string;
      };
    };
  }) =>
    clientFetch<AssistantChatResponse>("/assistant/chat", { method: "POST", body: JSON.stringify(data) }),

  // Admin site-work
  siteEngineers: () => clientFetch<SiteEngineer[]>("/admin/site-work/engineers"),
  createSiteEngineer: (data: Record<string, unknown>) =>
    clientFetch<SiteEngineer>("/admin/site-work/engineers", { method: "POST", body: JSON.stringify(data) }),
  updateSiteEngineer: (id: string, data: Record<string, unknown>) =>
    clientFetch<SiteEngineer>(`/admin/site-work/engineers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSiteEngineer: (id: string) =>
    clientFetch<{ ok?: boolean; deactivated?: boolean } | void>(`/admin/site-work/engineers/${id}`, {
      method: "DELETE",
    }),
  siteWorkers: () => clientFetch<SiteWorker[]>("/admin/site-work/workers"),
  siteWorker: (id: string) => clientFetch<SiteWorkerDetail>(`/admin/site-work/workers/${id}`),
  createSiteWorker: (data: Record<string, unknown>) =>
    clientFetch<SiteWorker>("/admin/site-work/workers", { method: "POST", body: JSON.stringify(data) }),
  updateSiteWorker: (id: string, data: Record<string, unknown>) =>
    clientFetch<SiteWorker>(`/admin/site-work/workers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSiteWorker: (id: string) =>
    clientFetch<{ ok?: boolean; deactivated?: boolean } | void>(`/admin/site-work/workers/${id}`, {
      method: "DELETE",
    }),
  siteProject: (id: string, params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const q = qs.toString();
    return clientFetch<SiteProjectDetail>(`/admin/site-work/projects/${id}${q ? `?${q}` : ""}`);
  },
  siteProjectCostSummary: (id: string, params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const q = qs.toString();
    return clientFetch<SiteProjectCostSummary>(
      `/admin/site-work/projects/${id}/cost-summary${q ? `?${q}` : ""}`
    );
  },
  createSiteExpenseAdmin: (data: SiteExpenseInput & { engineerId?: string | null }) =>
    clientFetch<SiteExpense>("/admin/site-work/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  sitePortalProjectCostSummary: (id: string, params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const q = qs.toString();
    return clientFetch<SiteProjectCostSummary>(`/site/projects/${id}/cost-summary${q ? `?${q}` : ""}`);
  },
  assignSiteProjectWorker: (
    projectId: string,
    data: Record<string, unknown>
  ) =>
    clientFetch<Record<string, unknown>>(`/admin/site-work/projects/${projectId}/workers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  unassignSiteProjectWorker: (projectId: string, workerId: string) =>
    clientFetch<{ ok: boolean }>(`/admin/site-work/projects/${projectId}/workers/${workerId}`, {
      method: "DELETE",
    }),
  siteWeekPayouts: (projectId: string, weekStart?: string) => {
    const qs = new URLSearchParams({ projectId });
    if (weekStart) qs.set("weekStart", weekStart);
    return clientFetch<SiteWeekPayoutSheet>(`/admin/site-work/payouts?${qs}`);
  },
  markSitePayoutPaid: (data: {
    workerId: string;
    projectId: string;
    weekStart: string;
    paid: boolean;
    notes?: string | null;
  }) =>
    clientFetch<{
      id: string;
      workerId: string;
      projectId: string;
      weekStart: string;
      amount: string;
      paid: boolean;
      paidAt: string | null;
      paidBy: string | null;
    }>("/admin/site-work/payouts/mark-paid", { method: "POST", body: JSON.stringify(data) }),
  siteProjects: () => clientFetch<SiteProject[]>("/admin/site-work/projects"),
  createSiteProject: (data: Record<string, unknown>) =>
    clientFetch<SiteProject>("/admin/site-work/projects", { method: "POST", body: JSON.stringify(data) }),
  updateSiteProject: (id: string, data: Record<string, unknown>) =>
    clientFetch<SiteProject>(`/admin/site-work/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSiteProject: (id: string) =>
    clientFetch<{ ok?: boolean; deactivated?: boolean }>(`/admin/site-work/projects/${id}`, { method: "DELETE" }),
  downloadSiteProjectExcel: async (id: string) => {
    const res = await fetch(`${CLIENT_BASE}/admin/site-work/projects/${id}/excel`, {
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(body.error || "Download failed", res.status);
    }
    return res.blob();
  },
  siteProjectExcelPreviewAdmin: (id: string, sheet?: number) => {
    const qs = sheet != null ? `?sheet=${sheet}` : "";
    return clientFetch<SiteExcelPreview>(`/admin/site-work/projects/${id}/excel/preview${qs}`);
  },
  reimportSiteExcel: () =>
    clientFetch<{
      files: Array<{
        file: string;
        projectName: string;
        sheets: number;
        workers: number;
        dayRowsUpserted: number;
        weekCounter: number;
      }>;
      totalDayRows: number;
      recordCount: number;
    }>("/admin/site-work/excel/reimport", { method: "POST", body: JSON.stringify({}) }),
  siteProjectExcelPreview: (id: string, sheet?: number) => {
    const qs = sheet != null ? `?sheet=${sheet}` : "";
    return clientFetch<SiteExcelPreview>(`/site/projects/${id}/excel/preview${qs}`);
  },
  downloadSiteProjectExcelPortal: async (id: string) => {
    const res = await fetch(`${CLIENT_BASE}/site/projects/${id}/excel`, {
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(body.error || "Download failed", res.status);
    }
    return res.blob();
  },
  siteRecords: (params?: { projectId?: string; engineerId?: string; workerId?: string; weekStart?: string; date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.projectId) qs.set("projectId", params.projectId);
    if (params?.engineerId) qs.set("engineerId", params.engineerId);
    if (params?.workerId) qs.set("workerId", params.workerId);
    if (params?.weekStart) qs.set("weekStart", params.weekStart);
    if (params?.date) qs.set("date", params.date);
    const query = qs.toString();
    return clientFetch<SiteDailyRecord[]>(`/admin/site-work/records${query ? `?${query}` : ""}`);
  },
  siteWeekAdmin: (projectId: string, weekStart?: string) => {
    const qs = new URLSearchParams({ projectId });
    if (weekStart) qs.set("weekStart", weekStart);
    return clientFetch<SiteWeekSheet>(`/admin/site-work/week?${qs}`);
  },
  upsertSiteRecord: (data: Record<string, unknown>) =>
    clientFetch<SiteDailyRecord>("/admin/site-work/records", { method: "PUT", body: JSON.stringify(data) }),
  deleteSiteRecord: (id: string) => clientFetch<void>(`/admin/site-work/records/${id}`, { method: "DELETE" }),

  // Admin site expenses
  siteExpenseOverview: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v) as [string, string][]).toString();
    return clientFetch<SiteExpenseOverview>(`/admin/site-work/expenses/overview${qs ? `?${qs}` : ""}`);
  },
  siteExpensesAdmin: (params?: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v) as [string, string][]).toString();
    return clientFetch<{
      items: SiteExpense[];
      summary: SiteExpenseSummary;
      categories: SiteExpenseCategory[];
      paymentMethods: Array<{ key: string; ar: string; en: string }>;
    }>(`/admin/site-work/expenses${qs ? `?${qs}` : ""}`);
  },
  updateSiteExpenseAdmin: (id: string, data: Record<string, unknown>) =>
    clientFetch<SiteExpense>(`/admin/site-work/expenses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSiteExpenseAdmin: (id: string) =>
    clientFetch<void>(`/admin/site-work/expenses/${id}`, { method: "DELETE" }),
  siteExpenseReceiptUrlAdmin: (id: string) => `${CLIENT_BASE}/admin/site-work/expenses/${id}/receipt`,
  downloadSiteExpensesExcel: async (params?: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v) as [string, string][]).toString();
    const res = await fetch(`${CLIENT_BASE}/admin/site-work/expenses/export${qs ? `?${qs}` : ""}`, {
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(body.error || "Download failed", res.status);
    }
    return res.blob();
  },
  assignSiteCoordinator: (coordinatorId: string | null, projectIds: string[]) =>
    clientFetch<{ ok: boolean; updated: number }>("/admin/site-work/coordinators/assign", {
      method: "POST",
      body: JSON.stringify({ coordinatorId, projectIds }),
    }),
  ensureSiteCoordinators: () =>
    clientFetch<{
      coordinators: Array<{ id: string; name: string; email: string; created: boolean }>;
      assignments: Array<{
        projectId: string;
        projectName: string;
        coordinatorId: string;
        coordinatorName: string;
      }>;
    }>("/admin/site-work/coordinators/ensure-defaults", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  // Site engineer expenses
  siteExpenseMeta: () => clientFetch<SiteExpenseMeta>("/site/expenses/meta"),
  siteExpenseSummary: () => clientFetch<SiteEngineerExpenseSummary>("/site/expenses/summary"),
  siteExpenses: (params?: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v) as [string, string][]).toString();
    return clientFetch<{ items: SiteExpense[]; summary: SiteExpenseSummary }>(`/site/expenses${qs ? `?${qs}` : ""}`);
  },
  createSiteExpense: (data: SiteExpenseInput) =>
    clientFetch<SiteExpense>("/site/expenses", { method: "POST", body: JSON.stringify(data) }),
  updateSiteExpense: (id: string, data: SiteExpenseInput) =>
    clientFetch<SiteExpense>(`/site/expenses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSiteExpense: (id: string) => clientFetch<void>(`/site/expenses/${id}`, { method: "DELETE" }),
  siteExpense: (id: string) => clientFetch<SiteExpense>(`/site/expenses/${id}`),
  siteExpenseReceiptUrl: (id: string) => `${CLIENT_BASE}/site/expenses/${id}/receipt`,
  uploadSiteExpenseReceipt: async (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name || "receipt.jpg");
    const res = await fetch(`${CLIENT_BASE}/site/expenses/receipt`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(body.error || "Upload failed", res.status);
    }
    return (await res.json()) as { file: string; mime: string };
  },

  // Site engineer portal
  siteLogin: (identifier: string, passcode: string) =>
    clientFetch<{ id: string; email: string; name: string; isAdmin?: boolean }>("/site/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, passcode }),
    }),
  siteAdminEnter: () =>
    clientFetch<{ id: string; email: string; name: string; isAdmin: boolean; portalUrl: string }>(
      "/site/auth/admin-enter",
      { method: "POST", body: JSON.stringify({}) }
    ),
  siteLogout: () => clientFetch<void>("/site/auth/logout", { method: "POST" }),
  siteMe: () =>
    clientFetch<{ id: string; email: string; name: string; isAdmin?: boolean }>("/site/auth/me"),
  wipeSiteEngineers: () =>
    clientFetch<{ ok: boolean; deleted: number }>("/admin/site-work/engineers/wipe", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  siteMyProjects: () => clientFetch<SiteProjectSummary[]>("/site/projects"),
  siteProjectDay: (id: string, date: string) =>
    clientFetch<SiteDayPayload>(`/site/projects/${id}/day?date=${encodeURIComponent(date)}`),
  siteSaveDay: (
    id: string,
    data: {
      date: string;
      rows: Array<{ workerId: string; regularHours: number; extraHours: number; notes?: string | null }>;
    }
  ) =>
    clientFetch<{ date: string; records: SiteDailyRecord[] }>(`/site/projects/${id}/day`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  siteProjectWeek: (id: string, weekStart?: string) => {
    const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
    return clientFetch<SiteWeekSheet>(`/site/projects/${id}/week${qs}`);
  },
};
