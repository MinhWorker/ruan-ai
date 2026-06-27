# System Architecture

## Runtime Shape

Ruan AI is a NestJS application deployed as a GitHub App backend. It receives webhooks, creates jobs, assembles context, calls the AI provider, validates structured outputs, and writes comments/labels/project updates back to GitHub.

## Module Boundaries

| Module | Responsibility | Must not do |
| --- | --- | --- |
| `ConfigModule` | Load environment and repository defaults. | Make runtime workflow decisions. |
| `GithubWebhookModule` | Verify signatures, parse events, dedupe deliveries. | Call AI or perform long-running work. |
| `GithubClientModule` | Wrap GitHub App auth and REST/GraphQL calls. | Contain PM workflow logic. |
| `JobModule` | Queue, persist, retry, and mark jobs. | Decide AI prompts. |
| `PmWorkflowModule` | Select triage/planning/status/blocker workflows. | Know provider-specific AI details. |
| `ContextModule` | Build bounded, cited context packets. | Write to GitHub. |
| `AiModule` | Call Google AI Studio models and validate output envelopes. | Decide GitHub permissions. |
| `PolicyModule` | Authorize proposed GitHub writes and workflow transitions. | Generate natural language plans. |
| `GithubWriterModule` | Apply comments, labels, and project updates idempotently. | Accept unvalidated model output. |
| `TelemetryModule` | Record job lifecycle, model usage, validation failures, rate limits. | Store secrets or full unredacted prompts by default. |

## Data Flow

1. GitHub sends webhook.
2. `GithubWebhookModule` verifies signature and emits a normalized event.
3. `JobModule` creates or dedupes a job keyed by delivery ID and issue number.
4. `PmWorkflowModule` maps event or command to a workflow.
5. `ContextModule` fetches bounded GitHub/repo context.
6. `AiModule` requests a structured decision from the configured model.
7. `PolicyModule` validates proposed writes and rejects unsafe transitions.
8. `GithubWriterModule` posts comments and applies allowed labels/fields.
9. `TelemetryModule` records outcome and failure metadata.

## Error Handling

- Invalid signature: reject request and record no job.
- Duplicate delivery: return success without repeating writes.
- Unsupported command: post a short help comment.
- Model timeout or invalid JSON: retry once with a smaller context; then escalate to human.
- Rate limit: mark job delayed and post only if user-visible delay exceeds configured threshold.
- GitHub write failure: retry idempotently; if still failing, record operational error and avoid duplicate comments.

## Idempotency

Every app-authored comment must include a hidden marker with workflow, issue number, and logical output type. Updates should edit the previous app comment when the workflow represents the same logical state, such as current plan or current status.

## Configuration Surface

Repository configuration is loaded from a future `.ruan-ai.yml` file or repository settings table. MVP defaults must work without a repo config file.

Initial configurable values:

- app mention,
- enabled workflows,
- allowed labels,
- status label names,
- project field mapping,
- model routing profile,
- context file allowlist.

