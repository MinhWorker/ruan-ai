# 8. Durable Workflow State

Date: 2026-06-30

## Status

Accepted

## Context

The initial MVP relies heavily on GitHub comments and hidden HTML markers as the primary source of truth for workflow state (e.g., active plans, splits, blockers). While GitHub remains the visible source of truth for users, relying solely on GitHub comments for internal state management is insufficient for complex scenarios like pausing (`/stop`), tracking dependencies, and ensuring reliability during AI provider failures or process restarts.

We have already introduced Postgres-compatible storage for job deduplication and scheduled follow-ups (Issue #4). We need a durable workflow state design that tracks the progression of specific AI operations (triage, plan, split, status, blocker, stop) without mixing this data with provider configurations or violating our strict scope guardrails (no direct code execution, no PR review automation, no dashboards, and no MCP hosting).

## Decision

We will introduce durable workflow state storage as a separate model from jobs, follow-ups, and provider configuration. The storage will have two conceptual parts:

1. `workflow_states` (or equivalent): the current snapshot for each issue/workflow.
2. `workflow_events` (or equivalent): an append-only audit trail of workflow transitions and important external references.

The concrete table names can be chosen during implementation, but the model boundaries are fixed by this ADR.

### State Records and Keys

The durable state record will be uniquely identified by the GitHub issue and workflow it belongs to.

- **Identity:** Store `installation_id`, `repository_id`, `issue_node_id` when available, `issue_number`, and `workflow_type`. Owner/name can be stored as denormalized display data, but must not be the only stable key.
- **Uniqueness:** Use a unique constraint equivalent to `(repository_id, issue_number, workflow_type)` for workflow snapshots. A separate issue-level pause record can use `workflow_type = 'pause'`.
- **Workflow Type:** One of `triage`, `plan`, `split`, `status`, `blocker`, or `pause`.
- **Status:** A semantic state such as `not_started`, `running`, `waiting_human`, `completed`, `failed`, or `paused`.
- **Payload:** A bounded JSONB payload for per-workflow state, with no secrets, raw prompts, private keys, provider credentials, or unredacted external logs.
- **GitHub Link:** Nullable `comment_id`, `comment_node_id`, and marker metadata linking the internal state to the corresponding visible GitHub comment and hidden marker.
- **Versioning:** Track a monotonically increasing `state_version` to prevent stale jobs from overwriting newer state.

### Relationship to GitHub Comments/Markers

GitHub remains the user-visible source of truth. Durable workflow state is the service's internal coordination state and audit surface.

When the system writes or updates an app comment containing an HTML marker, it will update the matching `workflow_states` record in the same logical operation. When the app needs to know the current active plan, split result, blocker status, or pause state, it can query the database first and fall back to comment-marker hydration when no state row exists.

If GitHub and the database disagree, GitHub comments remain the visible record and the service must either reconcile from the latest valid marker or mark the workflow state as needing operator repair. The implementation must avoid silently deleting or rewriting user-visible GitHub history to force consistency.

### Per-Workflow State

- **Triage:** Tracks the completion of label discovery and initial assessment, preventing duplicate triage runs.
- **Plan:** Tracks the active plan comment, plan version, declared assumptions, dependency summary, and whether the plan is blocked by unanswered questions.
- **Split:** Tracks generated task packets, created sub-issue references when applicable, dependency ordering, and partial completion so interrupted splits can be resumed safely.
- **Status:** Tracks the last status synthesis, cited evidence, linked PR/check references if a future design enables them, and whether the status is stale.
- **Blocker:** Tracks escalation state, evidence used, human questions awaiting answers, and the next proving step when diagnosis is incomplete.
- **Pause:** Tracks issue-level `/stop` state separately from any single
  workflow. While paused, automatic issue workflows for that issue must not run.
  Manual slash commands remain allowed for now so maintainers can still ask for
  status, planning, or blocker context on a paused issue. Any future `/resume`
  command requires a separate design decision before implementation.

### Migration from Comments-Only State

To ensure backwards compatibility and smooth migration:

1. When a workflow is triggered for an issue that lacks a `workflow_states` record, the system will read the issue's existing comments to find the latest valid HTML marker.
2. It will use this marker to upsert a new record into the `workflow_states` table, effectively hydrating the database from the GitHub visible record.
3. It will write a `workflow_events` entry noting that the state was hydrated from GitHub comments.
4. Subsequent operations will read durable state first and keep GitHub comments synchronized through the existing idempotent writer behavior.

### Retry and Audit Behavior

The existing `jobs` table handles retries at the webhook/event level. Durable workflow state records higher-level semantic progress for the issue workflow.

If a job fails after exhausting retries, the corresponding workflow state is marked as `failed` only when the failure prevents the workflow from reaching a valid user-visible result. The failure event must record a safe category, job ID, workflow type, and sanitized external references. It must not store secrets, raw prompts, provider credentials, or full external logs.

The append-only event stream supports operator audit without scraping only GitHub comments. Events should include state transitions, hydration, comment upserts, policy rejections, human-question transitions, pause/unpause decisions once designed, and repair actions.

## Follow-up Implementation Issues

Implementation of this design will be tracked via subsequent issues:

- Schema migration for `workflow_states` and `workflow_events`.
- Repository interface and Postgres/in-memory implementations for workflow state.
- Workflow service integration for triage, plan, split, status, blocker, and pause snapshots.
- GitHub marker hydration and reconciliation logic.
- `/stop` behavior update to write issue-level pause state.
- Tests for stale job version handling, comment-marker hydration, pause gating, and retry/audit transitions.

## Consequences

**Positive:**

- Enables robust pause (`/stop`) semantics without relying on label polling.
- Improves reliability during complex, multi-step workflows like `/split`.
- Reduces GitHub API read load by querying internal state.
- Maintains strict separation from provider configurations and billing identity.

**Negative:**

- Adds complexity to the state management layer, requiring synchronization between GitHub and Postgres.
- Requires a database schema migration.
- Requires careful versioning so older webhook jobs cannot overwrite newer issue state.
