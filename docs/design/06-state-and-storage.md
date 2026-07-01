# State And Storage

## Source Of Truth

GitHub is the visible source of truth for MVP state:

- issue body and comments,
- app-authored plan/status comments,
- labels,
- optional project fields,
- linked issues and PRs.

The service stores only operational state needed for reliability.

## Internal State

Minimal internal records:

- provider configuration mappings (mapping `repositoryId`/`installationId` to config properties and Secret Manager references),
- installation ID and repository ID mapping,
- webhook delivery ID dedupe,
- job ID, workflow type, status, attempts, and timestamps,
- model call metadata, not full secret-bearing prompts,
- app comment IDs for idempotent updates,
- scheduled follow-up state,
- durable workflow state (tracking triage, plan, split, status, blocker, and paused state per issue),
- rate-limit budget counters.

**Note on Provider Configuration Storage**: Provider configuration requires durable storage but is strictly separated from persistent job storage and durable workflow state. Provider configuration governs identity and billing (i.e. _who_ pays for AI execution), while job/workflow states govern progress and event history (i.e. _what_ is happening). These must reside in separate database models.

## Job States

| State           | Meaning                                           |
| --------------- | ------------------------------------------------- |
| `queued`        | Webhook accepted, waiting for processing.         |
| `running`       | Workflow is assembling context or calling AI.     |
| `waiting_human` | Workflow cannot proceed without a human answer.   |
| `delayed`       | Retry or rate-limit delay is active.              |
| `completed`     | Valid output was written or no write was needed.  |
| `failed`        | Exhausted retries or hit a non-recoverable error. |
| `paused`        | User issued `/stop`.                              |

## GitHub Comment Markers

App comments include hidden metadata:

```html
<!-- ruan-ai:workflow=plan issue=123 logical=active-plan version=1 -->
```

The writer uses the marker to update existing logical comments instead of duplicating them.

## Labels

MVP label behavior:

- apply only existing repository labels,
- never create labels automatically,
- never remove labels not managed by the app,
- keep app-managed labels configurable.

Suggested app-managed labels:

- `ruan:needs-info`
- `ruan:planned`
- `ruan:blocked`
- `ruan:ready-for-agent`
- `ruan:paused`

## Database Choice

The design does not require a specific database in the documentation phase. Implementation should use a relational store if job retries, scheduled follow-ups, or multi-installation deployments require persistence. SQLite is acceptable for local development; Postgres is preferred for hosted deployment.
