# Roadmap And Backlog

## Milestone 0: Design Baseline

Deliverables:

- upstream research notes,
- product requirements,
- GitHub App workflow design,
- NestJS architecture,
- AI orchestration contract,
- state and security design,
- agent execution guide,
- ADRs for current decisions.

Exit criteria:

- docs contain no placeholders,
- MVP scope is traceable,
- coding agents can start implementation without product decisions.

## Milestone 1: App Skeleton

Build:

- configuration validation,
- GitHub webhook endpoint,
- signature verification,
- normalized event DTOs,
- job state interface,
- health endpoint,
- unit/e2e tests.

No AI provider calls in this milestone.

## Milestone 2: GitHub Triage Workflow

Build:

- issue opened handling,
- repository label discovery,
- context packet for issue triage,
- AI output schema for triage,
- policy-validated comment and existing-label writes,
- fixtures for prompt injection attempts.

## Milestone 3: Planning And Splitting

Build:

- `/plan`,
- `/split`,
- active plan comment markers,
- task handoff output,
- dependency and parallelism wording,
- invalid-output repair retry.

## Milestone 4: Status And Blockers

Build:

- `/status`,
- `/blocker`,
- scheduled follow-up records,
- paused state via `/stop`,
- blocker escalation questions.

## Milestone 5: Operations

Build:

- telemetry and audit views,
- rate-limit dashboards,
- model availability validation,
- operational runbooks.

## Phase 2: Real Provider Integration

Build:

- real GitHub App read/write adapters,
- real Google AI Studio adapter,
- provider-mode config gating,
- pagination and idempotent comment hardening,
- credential-backed live integration tests gated by explicit env vars,
- multi-repository provider configuration storage (Issue #15),
- Google Cloud Gemini Enterprise Agent Platform API provider implementation (formerly Vertex AI; Issue #45).

Exit criteria:

- fake mode remains the default local/test path,
- real mode fails fast when required credentials are missing,
- read-only live integration passes against the configured pilot repository,
- live write tests remain opt-in only.

## Phase 3: Production Job Execution

Build:

- a production execution path for queued webhook jobs,
- explicit config for inline or worker execution mode,
- bounded retries and failure marking,
- telemetry/audit records for execution start, success, failure, and skipped jobs,
- e2e tests proving a signed webhook can execute a workflow without manual `processJob` calls.
- durable workflow state for triage, plan, split, status, blocker, and pause behavior as defined by ADR 0008.

Constraints:

- Do not add a database in this phase unless explicitly approved.
- Do not run unbounded long work in the webhook request path.
- Keep Cloud Run scale-to-zero behavior viable for the current pilot.
- Keep duplicate webhook delivery behavior idempotent.

Exit criteria:

- Cloud Run can receive a real GitHub webhook and produce the expected app-authored GitHub write for supported MVP workflows.
- Existing fake-mode tests still pass.
- Live read-only integration still passes.
- Any live write pilot is explicitly owner-approved and uses a test issue.

## Deferred Backlog

- PR review workflow.
- Release notes.
- GitHub Action companion.
- Project board dashboards.
- Direct coding-agent execution.
- Multi-repository portfolio planning.
- Browser/IDE integration.
- MCP tool hosting.
