# Milestone 5 Antigravity Prompt

Use this prompt after Milestone 4 has been reviewed and committed.

```text
You are working in D:\ai\ruan-ai, a NestJS project for an AI Project Manager GitHub App.

Current baseline:
- Milestone 1 app skeleton is implemented.
- Milestone 2 triage workflow is implemented.
- Milestone 3 planning and splitting are implemented.
- Milestone 4 status, blocker, stop, and in-memory follow-up records are implemented.
- Existing fake GitHub and fake AI boundaries are intentional. Do not replace them with real network integrations unless explicitly requested.

Read these files before coding:
- docs/design/04-system-architecture.md
- docs/design/05-ai-orchestration.md
- docs/design/06-state-and-storage.md
- docs/design/07-security-and-permissions.md
- docs/design/09-roadmap-and-backlog.md
- src/pm-workflow/services/*.ts
- src/ai/interfaces/ai-client.interface.ts
- src/job/interfaces/job.interface.ts
- src/job/interfaces/follow-up-record.interface.ts
- src/policy/services/triage-policy.service.ts

Task: implement Milestone 5 from docs/design/09-roadmap-and-backlog.md: Operations.

Milestone 5 scope:
- telemetry and audit views,
- rate-limit dashboards,
- model availability validation,
- operational runbooks.

Interpretation for this backend-only repo:
- "Views" and "dashboards" mean authenticated/internal JSON endpoints and typed service APIs, not a frontend UI.
- Keep data in memory unless the existing project already has a persistence abstraction. Do not add a database.
- Do not use real Google AI Studio or real GitHub credentials. Implement provider boundaries and fake validators suitable for tests.

Hard constraints:
- Do not implement PR review workflow, release notes, GitHub Action companion, project board dashboards, direct coding-agent execution, browser/IDE integration, MCP hosting, or real external API calls.
- Never store secrets, full unredacted prompts, raw private keys, or env values in telemetry/audit records.
- Telemetry must support redaction of secret-like strings before storage and response output.
- Existing milestone tests must keep passing.

Expected architecture:
1. Add TelemetryModule
   - Define telemetry event interfaces for job lifecycle, model calls, validation failures, rate-limit events, policy decisions, GitHub write attempts, and operational errors.
   - Add an in-memory telemetry repository with query methods by time range, workflow, repository, issue, job ID, and severity.
   - Add TelemetryService with record/query helpers.
   - Keep records bounded in memory to avoid unbounded growth. Use a configurable max record count with a safe default.

2. Add audit records
   - Define audit record structure covering:
     - job ID,
     - workflow,
     - delivery ID or command comment ID,
     - repository owner/name,
     - issue number,
     - proposed write summary,
     - policy decision,
     - writer result metadata,
     - createdAt.
   - Record audit events at policy/write boundaries where the existing fake writer/workflows make this practical.
   - Redact body text enough to avoid storing secrets while preserving useful operational summaries.

3. Add operations JSON endpoints
   - Add internal operations controller under a clear path such as `/ops`.
   - Endpoints should expose:
     - health/summary of telemetry counts,
     - recent job lifecycle events,
     - validation failures,
     - policy rejections,
     - rate-limit snapshot,
     - model availability status,
     - audit records.
   - Keep endpoints deterministic and testable. If auth is out of scope, explicitly mark them as internal-only in code comments and docs; do not pretend production auth exists.

4. Add rate-limit dashboard data
   - Add in-memory rate-limit tracker for AI model and GitHub API budgets.
   - Track configured/requested model profile, request counts, token estimates if available, last rate-limit error, resetAt if known, and degraded state.
   - Expose snapshot through ops endpoint/service.
   - Do not call real providers.

5. Add model availability validation
   - Define a ModelAvailabilityService that validates configured model IDs using the configured fake AI provider.
   - It should return structured status: available, unavailable, unknown, model id, checkedAt, reason, and fallback model id if configured.
   - Wire startup-safe validation in a way that can be called by tests and ops endpoint without failing app bootstrap in fake mode.
   - Do not hard-code real model IDs as guaranteed valid.

6. Add operational runbooks
   - Add docs under `docs/operations/`.
   - Include runbooks for:
     - local verification,
     - webhook signature failures,
     - model unavailable or rate-limited,
     - invalid AI output repair failures,
     - policy rejection investigation,
     - paused issue/follow-up recovery,
     - preparing real GitHub App and Google AI Studio credentials later.
   - Keep runbooks concrete with commands and expected signals.

Testing requirements:
- Unit tests for telemetry repository/service.
- Unit tests for redaction behavior.
- Unit tests for audit record creation/querying.
- Unit tests for rate-limit tracker snapshots and degraded state.
- Unit tests for model availability service using fake providers.
- Controller/e2e tests for `/ops` JSON endpoints.
- Regression tests proving secret-like strings are redacted before telemetry/audit output.
- Existing workflow tests must continue passing.

Verification commands:
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run lint
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e

Completion report:
- Summarize files added/changed.
- Confirm exact Milestone 5 scope implemented.
- List deferred items.
- Paste verification results.
```
