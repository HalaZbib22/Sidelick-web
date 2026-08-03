# Runbook: Database Backup & Restore

## How backups work

- **Nightly** at 02:00 UTC, the `Database backup` workflow dumps production
  (`pg_dump -Fc`), keeps the **last 7 dumps on the server** at
  `/opt/sidelick/backups/`, and uploads an **AES-256-encrypted copy** as a
  GitHub Actions artifact (30-day retention).
- Encryption key: the `BACKUP_ENCRYPTION_KEY` repo secret. **A copy of this
  key must live in the founder's password manager** — an encrypted backup
  without its key is garbage.
- The workflow verifies every dump with `pg_restore --list` before upload; a
  red run means the night's backup FAILED — treat it as an incident.

## Restore — server copy (fast path: bad deploy, bad data)

SSH to the server (or use a maintenance workflow) and:

```bash
ls -lt /opt/sidelick/backups/                # pick the dump to restore
docker exec -i sidelick-postgres pg_restore -U sidelick -d sidelick \
  --clean --if-exists < /opt/sidelick/backups/sidelick-YYYYMMDD-HHMMSS.dump
docker compose --env-file .env.docker restart backend
```

`--clean --if-exists` drops and recreates objects — the database returns to
exactly the dump's state. Anything written after the dump is lost.

## Restore — off-server copy (disaster path: dead server)

1. Download the newest `db-backup-*` artifact from the Actions tab.
2. Decrypt:
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
     -in sidelick.dump.enc -out sidelick.dump -pass pass:'THE_BACKUP_KEY'
   ```
3. Stand up the stack on the new server (deploy workflow), then:
   ```bash
   docker exec -i sidelick-postgres pg_restore -U sidelick -d sidelick \
     --clean --if-exists < sidelick.dump
   ```
4. Repoint DNS if the server changed. Total loss window: at most 24 hours of
   data (the time since the last nightly run).

## Discipline

- **Monthly restore drill:** download an artifact, decrypt it, and restore it
  into a local/dev database. A backup that has never been restored is a hope,
  not a backup. Put a repeating reminder on the calendar.
- Before any risky manual SQL on production, trigger the workflow manually
  (`workflow_dispatch`) so there's a fresh dump minutes old.
- If `BACKUP_ENCRYPTION_KEY` is ever rotated, note the date — artifacts made
  before rotation need the OLD key. Keep retired keys in the password manager,
  labeled with their validity window.
