import { ApiError } from "./api";

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/invest/agent`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: isForm ? init?.headers : { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || "Request failed", res.status);
  }
  return res.json();
}

export type AgentAttachment = { documentId: string; name: string; mime: string };
export type AgentAction = { label: string; href?: string };
export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: AgentAttachment[];
  actions: AgentAction[];
  createdAt: string;
};
export type AgentConversation = { id: string; title: string; projectId: string | null; updatedAt?: string };
export type AgentMemory = { id: string; content: string; createdAt: string };
export type AgentKnowledgeFile = { projectId: string; name: string; status: string; updatedAt: string; hash: string };

/** Decrypted download link (admin session cookie required). `id` = project id or "index". */
export const knowledgeHref = (id: string, format: "json" | "txt") => `${BASE}/knowledge/${id}/${format}`;

export const agentApi = {
  status: () => call<{ enabled: boolean; vision: boolean }>("/status"),
  conversations: () => call<AgentConversation[]>("/conversations"),
  createConversation: (projectId?: string | null) =>
    call<AgentConversation>("/conversations", { method: "POST", body: JSON.stringify({ projectId: projectId ?? null }) }),
  conversation: (id: string) => call<{ conversation: AgentConversation; messages: AgentMessage[] }>(`/conversations/${id}`),
  deleteConversation: (id: string) => call<{ ok: boolean }>(`/conversations/${id}`, { method: "DELETE" }),
  send: (id: string, text: string, attachmentIds: string[]) =>
    call<{ user: AgentMessage; reply: AgentMessage; projectId: string | null }>(`/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text, attachmentIds }),
    }),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return call<AgentAttachment>("/attachments", { method: "POST", body: fd });
  },
  transcribe: (blob: Blob) => {
    const fd = new FormData();
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    fd.append("audio", blob, `voice.${ext}`);
    return call<{ text: string }>("/transcribe", { method: "POST", body: fd });
  },
  memory: () => call<AgentMemory[]>("/memory"),
  addMemory: (content: string) => call<AgentMemory>("/memory", { method: "POST", body: JSON.stringify({ content }) }),
  deleteMemory: (id: string) => call<{ ok: boolean }>(`/memory/${id}`, { method: "DELETE" }),
  knowledge: () => call<AgentKnowledgeFile[]>("/knowledge"),
  syncKnowledge: () => call<{ projects: number }>("/knowledge/sync", { method: "POST" }),
};
