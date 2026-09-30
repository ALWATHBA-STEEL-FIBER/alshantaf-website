# Alshantaf assistant knowledge pack (2026-09-30)

Customer-facing prompt/RAG material for the site assistant (Groq). This is **not** weight fine-tuning; the runtime loads:

- `01-SYSTEM-PROMPT-AR.txt` → system instructions
- `02-KNOWLEDGE-BASE-AR.md` + `07-SOURCES-AND-VERIFICATION.md` → retrieved chunks per user message
- `04-TRAINING-EXAMPLES.jsonl` → few-shot style examples (JSON reply shape)

Do **not** inject `08-ADMIN-REVIEW-NOTES.md` into public chat context.

Live listing availability/price always comes from the database digest, not from these files.
