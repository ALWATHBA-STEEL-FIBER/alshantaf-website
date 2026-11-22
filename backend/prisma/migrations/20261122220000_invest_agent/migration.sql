-- Admin investment assistant: conversations, messages and per-admin memory.
CREATE TABLE "InvAgentConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'محادثة جديدة',
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvAgentConversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvAgentConversation_userId_updatedAt_idx" ON "InvAgentConversation"("userId", "updatedAt");

CREATE TABLE "InvAgentMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "toolCalls" JSONB,
    "toolCallId" TEXT,
    "attachments" JSONB,
    "actions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvAgentMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvAgentMessage_conversationId_createdAt_idx" ON "InvAgentMessage"("conversationId", "createdAt");
ALTER TABLE "InvAgentMessage" ADD CONSTRAINT "InvAgentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "InvAgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InvAgentMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvAgentMemory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvAgentMemory_userId_idx" ON "InvAgentMemory"("userId");
