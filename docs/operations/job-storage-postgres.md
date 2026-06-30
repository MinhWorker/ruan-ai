# Job Storage: Postgres-Compatible Setup

Ruan AI keeps in-memory job and follow-up storage by default. Use
Postgres-compatible storage when webhook delivery dedupe, job attempts, and
scheduled follow-ups must survive process restarts or Cloud Run instance
replacement.

## Configuration

Default local mode:

```powershell
JOB_STORAGE_MODE=memory
```

Postgres mode:

```powershell
JOB_STORAGE_MODE=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

`DATABASE_URL` is required only when `JOB_STORAGE_MODE=postgres`. Do not commit
database URLs, passwords, or provider console output. For hosted staging, store
the URL in the deployment secret/env management path approved by the owner.

For Neon Postgres free tier, create the database in Neon manually, copy the
pooled connection string into the approved secret store or local `.env`, and
apply the schema below with a SQL client. This repository does not provision
Neon resources automatically.

## Schema

```sql
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  workflow_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  issue_number INTEGER,
  repository_id BIGINT,
  repository_owner TEXT,
  repository_name TEXT,
  sender_login TEXT,
  comment_id BIGINT,
  comment_body TEXT,
  installation_id BIGINT
);

CREATE INDEX IF NOT EXISTS jobs_status_updated_at_idx
  ON jobs (status, updated_at);

CREATE TABLE IF NOT EXISTS follow_up_records (
  id TEXT PRIMARY KEY,
  issue_number INTEGER NOT NULL,
  repository_id BIGINT,
  repository_owner TEXT,
  repository_name TEXT,
  workflow TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS follow_up_records_issue_idx
  ON follow_up_records (issue_number, repository_owner, repository_name);

CREATE INDEX IF NOT EXISTS follow_up_records_pending_due_at_idx
  ON follow_up_records (status, due_at)
  WHERE status = 'pending';
```

## Rollback

Set `JOB_STORAGE_MODE=memory` and restart the service. This stops using
Postgres for new runtime state but does not delete database rows.

## Verification

Local CI does not require a live database. Repository tests use a shared fake
Postgres pool to prove persistence behavior across repository instance
recreation.
