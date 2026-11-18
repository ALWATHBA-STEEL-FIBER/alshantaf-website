# Al Shantaf Investment Partnership Platform — Architecture

**Status:** Implemented foundation (v1)  
**Market:** Jordan first (AR/EN, JOD), multi-currency ready  
**Stack:** Existing Al Shantaf modular monolith — Express + Prisma + PostgreSQL + Next.js

## 1. Open-source evaluation (Phase 1)

| Candidate | License | Stack | Fit | Verdict |
|---|---|---|---|---|
| **Madar** (`ildrm/madar-investment-operations-platform`) | MIT | Fastify + React + PostgreSQL + `decimal.js` | Closest financial invariants (immutable journals, maker-checker, investor portal). Domain is pooled NAV / fund ops / trading — **not** land partnership settlement waterfalls. Docs admit ledger is target architecture; schema exists but product domain differs. | **Adopt patterns only** (decimal math, balanced journals, immutability, approvals). Do not fork as app shell. |
| **ERPNext** | GPL-3.0 | Python / Frappe / MariaDB | Mature ERP accounting, projects, CRM. Wrong runtime vs Al Shantaf Node stack; heavy ops footprint; general ERP ≠ partnership settlement. | **Reference only** for chart-of-accounts concepts. |
| **OpenBooks** | **AGPL-3.0-or-later** | Next.js monorepo | Strong ledger claims; **alpha**; AGPL copyleft would force source disclosure for a networked commercial product. | **Do not adopt** (license + domain mismatch). |
| **Gauzy** | **AGPL-3.0** | Angular + NestJS | Employee profit-sharing / agency ERP, not land co-investment. Wrong framework. | **Do not adopt**. |

### Selected foundation

**Primary architecture:** extend the existing **Al Shantaf** modular monolith.

**Why superior for this product:**

1. Already deployed for Al Shantaf (Postgres, Docker Compose, nginx, admin auth, bilingual UI, uploads).
2. Domain is **land partnership settlement**, not fund NAV or general ERP — none of the candidates implement the required waterfall.
3. Avoids AGPL contamination and framework rewrites.
4. Madar’s MIT financial patterns (exact decimals, balanced journals, reversals, maker-checker) are reimplemented in `backend/src/invest/finance/` for this domain.

**Rule:** one accounting engine — the invest ledger module. Site-work expenses remain operational construction tooling and are not dual-posted into partnership books unless explicitly linked later.

## 2. Module map

```
Authentication / Admin RBAC     → existing User + permissions (+ "invest")
Investor portal auth            → InvPortalUser (investor-scoped session)
Organizations                   → InvOrganization (multi-tenant ready; single default org seeded)
Investors                       → InvInvestor
Projects                        → InvProject + status history
Ownership & capital             → InvMembership, InvContribution
Expenses & reimbursements       → InvExpense (+ approval)
Commissions                     → InvCommissionRule (per project / per investor)
Settlement engine               → pure finance module + InvSettlement*
Accounting ledger               → InvLedgerAccount, InvJournal, InvJournalLine (immutable when POSTED)
Documents                       → InvDocument (private uploads)
Audit                           → InvAuditEvent (append-only) + existing AuditLog for admin actions
Reporting / simulator           → read models + simulate endpoint (no writes)
```

## 3. Financial invariants

1. Money uses `decimal.js` (banker’s rounding / HALF_EVEN). No JS `number` arithmetic for persisted money.
2. JOD scale default = **3** (fils). Other currencies use ISO scale or project override.
3. Ownership percentages for a project’s equity pool must sum to 100% (± deterministic residual cents assigned to the largest holder).
4. Expense payments never silently change ownership %.
5. Posted journals are immutable; corrections are reversals / adjusting journals.
6. Every posted journal balances **per currency**.
7. Maker ≠ checker for expense approval and settlement finalization.
8. Settlement simulator never writes ledger rows; responses are marked `hypothetical: true`.
9. Concurrent settlement posting is guarded by a project-level advisory lock / unique open-settlement constraint.

## 4. Default settlement waterfall

Configurable per project (`waterfallSteps` JSON). Default:

1. `record_sale_proceeds`
2. `deduct_closing_costs`
3. `return_capital`
4. `reimburse_expenses`
5. `calculate_distributable_profit`
6. `apply_coordinator_commission`
7. `distribute_profit_by_ownership`
8. `record_payouts`

## 5. Deployment

Same Docker Compose stack. New tables via Prisma migration `20261118180000_investment_partnerships`. Private documents under `backend/uploads/invest/`. No AWS-only services required.

## 6. Legal disclaimer

This software supports operational transparency and arithmetic correctness. It is **not** legal, tax, or regulatory advice and is not certified for any jurisdiction.
