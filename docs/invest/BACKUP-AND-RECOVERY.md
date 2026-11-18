# Investment platform — backup and recovery

## Database

PostgreSQL is the source of truth for all partnership ledgers, settlements, and audit events.

### Backup (Docker Compose)

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backup-$(date +%Y%m%d).dump"
```

Store dumps off-box. Prefer daily cron on the VPS.

### Restore

```bash
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup-YYYYMMDD.dump
```

After restore, run `docker compose exec backend npx prisma migrate deploy` only if the dump predates schema migrations.

## Uploaded documents

Invest documents live under `backend/uploads/invest/` (bind-mounted). Include that directory in filesystem backups alongside `pgdata`.

## What must never be deleted

- Posted `InvJournal` / `InvJournalLine` rows
- `InvAuditEvent` history
- Posted `InvSettlement` records

Corrections use reversing journals and new settlements — not silent deletes.
