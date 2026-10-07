import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireFullAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { audit } from "../lib/audit";
import {
  ASSISTANT_KNOWLEDGE_MAX_CHARS,
  defaultAssistantKnowledge,
  getAssistantKnowledge,
  resetAssistantKnowledge,
  setAssistantKnowledge,
} from "../lib/assistantKnowledge";

export const adminAssistantKnowledgeRouter = Router();
adminAssistantKnowledgeRouter.use(requireAdmin);
adminAssistantKnowledgeRouter.use(requireFullAdmin);

const patchSchema = z.object({
  content: z.string().max(ASSISTANT_KNOWLEDGE_MAX_CHARS),
});

adminAssistantKnowledgeRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const content = await getAssistantKnowledge();
    res.json({
      content,
      defaultLength: defaultAssistantKnowledge().length,
      maxChars: ASSISTANT_KNOWLEDGE_MAX_CHARS,
    });
  })
);

adminAssistantKnowledgeRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const { content } = patchSchema.parse(req.body);
    try {
      const saved = await setAssistantKnowledge(content);
      await audit({
        actorEmail: req.session!.email,
        action: "assistant_knowledge.update",
        targetType: "setting",
        targetId: "assistantMasterKnowledge",
        metadata: { fields: ["assistantMasterKnowledge"], bytes: saved.length },
        ip: req.ip,
      });
      res.json({
        content: saved,
        defaultLength: defaultAssistantKnowledge().length,
        maxChars: ASSISTANT_KNOWLEDGE_MAX_CHARS,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not save knowledge" });
    }
  })
);

adminAssistantKnowledgeRouter.post(
  "/reset",
  asyncHandler(async (req, res) => {
    const saved = await resetAssistantKnowledge();
    await audit({
      actorEmail: req.session!.email,
      action: "assistant_knowledge.reset",
      targetType: "setting",
      targetId: "assistantMasterKnowledge",
      metadata: { fields: ["assistantMasterKnowledge"], bytes: saved.length },
      ip: req.ip,
    });
    res.json({
      content: saved,
      defaultLength: defaultAssistantKnowledge().length,
      maxChars: ASSISTANT_KNOWLEDGE_MAX_CHARS,
    });
  })
);