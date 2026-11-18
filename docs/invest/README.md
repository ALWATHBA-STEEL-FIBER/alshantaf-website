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
