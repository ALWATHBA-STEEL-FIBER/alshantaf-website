# Investment Partnership Management

Land co-investment module for Al Shantaf: multi-project, multi-investor capital, expenses, double-entry ledger, settlement waterfall, simulator, and investor portal.

## Architecture decision

See [ARCHITECTURE.md](./ARCHITECTURE.md). Primary foundation is the existing Express + Prisma + Next.js monolith. Madar (MIT) inspired decimal/ledger invariants; ERPNext / OpenBooks / Gauzy were not adopted (stack or AGPL).

## Admin UI

- `/admin/invest` — portfolio dashboard  
- `/admin/invest/projects` — projects  
- `/admin/invest/projects/[id]` — workspace (members, capital, expenses, simulator, settlement)  
- `/admin/invest/investors` — investor register  

Requires the `invest` (or `*`) admin permission.

## Investor portal

- `/investor/login`  
- `/investor` — own dashboard only  
- `/investor/projects/[id]` — own membership, capital, estimates  

## API

Mounted at `/api/invest/*` (admin session cookie) and `/api/invest/portal/*` (investor `invest_session` cookie).

## Financial engine

Pure domain module: `backend/src/invest/finance/`

```bash
cd backend && npm run test:invest
```

Spec demo (sale 960,000 / capital 500,000 / expense 100,000 → profit 360,000 → 72k / 144k / 144k) is covered by automated tests.

## Demo seed (local only)

```bash
cd backend && npm run seed:invest-demo
```

Creates project `DEMO-LAND-960K` and portal users (see script output). **Do not use demo passwords in production.**

## Migrations / deploy

```bash
docker compose exec backend npx prisma migrate deploy
```

Backup: [BACKUP-AND-RECOVERY.md](./BACKUP-AND-RECOVERY.md).

## Security notes

- PII (national ID, bank details) stored AES-GCM encrypted (`INVEST_PII_SECRET` or `JWT_SECRET`).
- Maker-checker: expense creator cannot approve their own expense.
- Posted journals are immutable; settlements use idempotency keys.
- Simulator responses always include `hypothetical: true` and never write the ledger.

## Partner CRM & profit split (v2, 2026-11-22)

- `/admin/invest/investors` — searchable partner register: name, partner no. (`P-0001`), phone, email, full national ID (HMAC blind index) or its last 4 digits. Duplicate phone / national ID / email is blocked unless confirmed.
- `/admin/invest/projects/new` — one-page setup: land details, pick partners and their capital (ownership % computed live), coordinator, coordinator cut, live payout preview.
- Project workspace tabs: overview, partners (per-partner cut override, 0 = exempt), capital (payments, withdrawals, reversals), expenses (paid by a partner → refunded at sale, or from the project pool; approve now; void), sale & payout (what-if calculator → close & distribute → mark each partner paid), details & log.
- Default coordinator rule is `investor_net_profit`: X% is taken from each partner's gross profit share; the coordinator is never charged on his own share. Every settlement line stores gross profit (before cut), cut, net profit (after cut), cut earned, payout, ROI.
- Losses are shared by ownership by default (`shareLossesByOwnership`).
- Maker-checker for expenses is opt-in via `INVEST_STRICT_MAKER_CHECKER=1`.

## Contract, cost split & valuation (v3, 2026-11-22)

- **Capital tab** — each payment stores a method (cash / bank transfer / cheque) and a reference number. Payments can be **edited** (amount, type, partner, date) or **deleted** while the project is open: the old journal is reversed and a corrected one posted, ownership recalculates, and a partner's capital can never go negative.
- **Expenses** — each expense has a cost split (`splitMode`): `ownership` (default), `equal`, or `custom` % per partner (must sum to 100; e.g. 100% on one partner). The table shows each partner's % and amount. Expenses can be edited (including amount/payer while not yet reimbursed; approved money changes re-post the journal) or deleted (blocked if reimbursed or it has attachments → void instead).
- **Settlement** — the payer is still reimbursed off the top. For non-ownership splits the engine moves profit: each partner gets back their ownership share of the expense and is charged their agreed share (`expenseBurden` / `expenseSplitAdjustment`). The coordinator cut is taken on the adjusted profit.
- **Costs & value tab** — total cost (land + expenses), cost per m², cost by category, per-partner division (land share, expense share, cost share, what they paid, balance), and the latest valuation assumption (`estimatedValue` + date + source) with what each stake is worth today.
- **Contract tab** — contract no./date/price, seller, deed and registry, broker, deposit, and the payment schedule to the seller (due / paid dates, overdue highlighted). Stored as `InvProject.contractDetails` JSON.

## v4 — Admin investment assistant (AI, voice + text)

Page: **Admin → شراكات الاستثمار → مساعد الاستثمار** (`/admin/invest/assistant`). Every project page also has "اسأل المساعد عن هذا المشروع", which opens the chat with that project as context.

- **Flow:** the admin describes a project by text or voice. The assistant asks only for what's missing, shows a summary, and creates the project after the admin confirms. The admin is the default coordinator. Later it records expenses and bills, payments, initial payments, contract details, valuation, and per-partner coordinator cuts. It answers questions (balances, who paid what, "what does everyone get if we sell at X" via a non-writing simulation).
- **Coordinator cut:** a % of each partner's net profit. There is a project default, which can be overridden per partner (e.g. 50% from selected partners). The coordinator does not need to invest (initial payment 0).
- **Tools:** all writes go through the same services as the UI (validation, double-entry journals, audit log). The assistant can't delete anything.
- **Voice:** recorded in the browser and transcribed server-side (OpenAI `gpt-4o-transcribe`, fallback `whisper-1`; Groq `whisper-large-v3-turbo`). The text goes into the box for review. Replies can be read aloud (browser speech).
- **Bills:** attach a photo or PDF. The model reads amount, date, vendor and invoice no. from images, records the expense, and links the file (`attach_document`).
- **Isolation:** own tables (`InvAgentConversation`, `InvAgentMessage`, `InvAgentMemory`), own prompt, own routes (`/api/invest/agent/*`). Nothing is shared with the public website assistant.
- **Memory:**
  - Per-admin notes (`remember` / `forget`, editable in "ذاكرة المساعد").
  - Per-project memory files: `<projectId>.json` and `.txt`, plus a portfolio index and assistant notes per project (`note_project`). They are rebuilt from live data on each turn, and the index goes into every prompt. Admins can download them decrypted.
- **Security:**
  - Requires `invest` plus the new `investAi` permission (full admins have it).
  - At rest, AES-256-GCM (key `INVEST_AGENT_SECRET`) encrypts message content, tool calls, actions, titles, memory notes, the project memory files (`<data>/invest-docs/agent-knowledge/*.enc`, mode 600) and uploaded bills (`*.enc`; plaintext copies are removed). Bills are decrypted only by the admin download route.
  - Rate limits: 20 messages per minute and 20 recordings per minute per admin.
