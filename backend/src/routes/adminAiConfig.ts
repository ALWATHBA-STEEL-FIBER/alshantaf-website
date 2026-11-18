import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireFullAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { audit } from "../lib/audit";
import { getAiConfigPublic, setAiConfig } from "../lib/aiConfig";

export const adminAiConfigRouter = Router();
adminAiConfigRouter.use(requireAdmin);
adminAiConfigRouter.use(requireFullAdmin);

const patchSchema = z.object({
  provider: z.enum(["auto", "openai", "groq"]).optional(),
  openaiModel: z.string().trim().min(1).max(120).optional(),
  openaiTemperature: z.number().min(0).max(1).optional(),
  openaiReasoningEffort: z.enum(["none", "low", "medium", "high"]).optional(),
  openaiMaxCompletionTokens: z.number().int().min(256).max(4000).optional(),
  openaiApiKey: z.string().max(512).optional(),
  clearOpenaiApiKey: z.boolean().optional(),
  groqModel: z.string().trim().min(1).max(120).optional(),
  groqTemperature: z.number().min(0).max(1).optional(),
  groqApiKey: z.string().max(512).optional(),
  clearGroqApiKey: z.boolean().optional(),
  guardEnabled: z.boolean().optional(),
  guardModel: z.string().trim().min(1).max(160).optional(),
  guardThreshold: z.number().min(0).max(1).optional(),
});

adminAiConfigRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await getAiConfigPublic());
  })
);

adminAiConfigRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const patch = patchSchema.parse(req.body);
    const before = await getAiConfigPublic();
    const after = await setAiConfig(patch);
    await audit({
      actorEmail: req.session!.email,
      action: "ai_config.update",
      targetType: "setting",
      targetId: "aiConfig",
      metadata: {
        fields: Object.keys(patch).filter((k) => !/ApiKey/i.test(k)),
        openaiKeyChanged: Boolean(patch.openaiApiKey?.trim()) || Boolean(patch.clearOpenaiApiKey),
        groqKeyChanged: Boolean(patch.groqApiKey?.trim()) || Boolean(patch.clearGroqApiKey),
        before: {
          provider: before.provider,
          openaiModel: before.openaiModel,
          groqModel: before.groqModel,
          activeProvider: before.activeProvider,
          activeModel: before.activeModel,
        },
        after: {
          provider: after.provider,
          openaiModel: after.openaiModel,
          groqModel: after.groqModel,
          activeProvider: after.activeProvider,
          activeModel: after.activeModel,
        },
      },
      ip: req.ip,
    });
    res.json(after);
  })
);
