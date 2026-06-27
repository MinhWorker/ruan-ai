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

## Deferred Backlog

- PR review workflow.
- Release notes.
- GitHub Action companion.
- Project board dashboards.
- Direct coding-agent execution.
- Multi-repository portfolio planning.
- Browser/IDE integration.
- MCP tool hosting.

