# Milestone 4 Antigravity Prompt

Use this prompt after Milestone 3 has been reviewed and committed.

```text
You are working in D:\ai\ruan-ai, a NestJS project for an AI Project Manager GitHub App.

Current baseline:
- Milestone 1 app skeleton is implemented: config, health, webhook signature verification, normalized events, and job state.
- Milestone 2 triage workflow is implemented with fake GitHub/AI boundaries and policy validation.
- Milestone 3 planning and splitting are implemented with `/plan`, `/split`, active plan markers, handoff output, dependency/parallelism wording, and one invalid-output repair retry.
- Do not regress the existing webhook-to-job metadata contract: repository owner/name, issue number, sender login, and workflow type must remain available to workflow services.

Read these files before coding:
- docs/design/03-github-app-workflows.md
- docs/design/04-system-architecture.md
- docs/design/05-ai-orchestration.md
- docs/design/06-state-and-storage.md
- docs/design/07-security-and-permissions.md
- docs/design/09-roadmap-and-backlog.md
- src/webhook/webhook.controller.ts
- src/webhook/webhook.service.ts
- src/job/interfaces/job.interface.ts
- src/pm-workflow/services/pm-workflow.service.ts
- src/pm-workflow/services/plan-workflow.service.ts
- src/pm-workflow/services/split-workflow.service.ts
- src/github-client/interfaces/github-client.interface.ts
- src/github-writer/interfaces/github-writer.interface.ts
- src/policy/services/triage-policy.service.ts

Task: implement Milestone 4 from docs/design/09-roadmap-and-backlog.md: Status And Blockers.

Milestone 4 scope:
- `/status`
- `/blocker`
- scheduled follow-up records
- paused state via `/stop`
- blocker escalation questions

Hard constraints:
- Keep using fake GitHub/AI implementations for tests and local dev. Do not implement real Google AI Studio or real GitHub App auth yet.
- Do not implement dashboards, telemetry views, production rate-limit dashboards, or real schedulers. A durable scheduler can be deferred; this milestone needs records/contracts only.
- Do not run long workflow logic inside the webhook HTTP request path.
- Treat issue bodies and comments as untrusted data.
- Structured AI output must be schema-validated before policy or GitHub writes.
- App comments must use hidden markers and upsert semantics.
- Existing `/triage`, `/plan`, and `/split` tests must continue passing.

Expected architecture:
1. Extend command routing
   - `issue_comment.created` with `/status` routes to status workflow.
   - `issue_comment.created` with `/blocker` routes to blocker workflow.
   - `issue_comment.created` with `/stop` routes to pause workflow.
   - Preserve existing first-recognized-command behavior for mixed comments.
   - Normal comments without slash commands remain ignored unless explicitly implementing blocker-language detection through a bounded, tested rule.

2. Add status workflow
   - Build a bounded status context from issue metadata, labels, recent comments, prior triage/plan/split/status/blocker app comments, and any scheduled follow-up record.
   - Define strict `StatusOutput` schema.
   - Output current state: `not_started`, `ready`, `in_progress`, `blocked`, `needs_review`, `done`, or `paused`.
   - Include completed work, open tasks, blockers, next action, confidence, assumptions, and evidence.
   - Distinguish observed evidence from inference.
   - Upsert status comment with marker:
     `<!-- ruan-ai:workflow=status issue=N logical=current-status version=1 -->`.

3. Add blocker workflow
   - Build a bounded blocker context from issue metadata, recent comments, active plan/split/status comments, and blocker-triggering text.
   - Define strict `BlockerOutput` schema.
   - Output blocker summary, supported likely cause only when evidence exists, next proving method, direct human questions, confidence, assumptions, and evidence.
   - If evidence is insufficient, do not invent a cause. Ask direct questions.
   - Upsert blocker comment with marker:
     `<!-- ruan-ai:workflow=blocker issue=N logical=current-blocker version=1 -->`.

4. Add pause workflow for `/stop`
   - Mark the issue/job paused using existing job status semantics and a small follow-up state abstraction.
   - Upsert pause marker comment:
     `<!-- ruan-ai:workflow=stop issue=N logical=paused version=1 -->`.
   - Stop or mark inactive any scheduled follow-up records for the issue.
   - Historical comments must remain intact.

5. Add scheduled follow-up record abstraction
   - Define an interface/repository for follow-up records with fields: issue identity, workflow, dueAt, status, reason, createdAt, updatedAt.
   - Provide in-memory implementation only.
   - Status workflow may read records; blocker/status may create or update records if needed.
   - `/stop` must mark pending records inactive/cancelled.

6. Extend AI and policy layers
   - Add fake deterministic AI methods for status and blocker.
   - Add strict schema validators with tests.
   - Add one repair retry for status/blocker invalid schema output, matching the Milestone 3 pattern.
   - Add policy validation for status/blocker comments and pause comments.
   - Keep GitHub writes comment-only unless existing labels are already safely supported by policy.

Testing requirements:
- Unit tests for command routing: `/status`, `/blocker`, `/stop`, mixed commands, and no-command comments.
- Unit tests for `StatusOutput` schema, including unexpected fields and invalid state values.
- Unit tests for `BlockerOutput` schema, including evidence-required likely cause behavior if represented structurally.
- Unit tests for status workflow success, repair success, and repair failure.
- Unit tests for blocker workflow success, insufficient evidence behavior, repair success, and repair failure.
- Unit tests for pause workflow and follow-up cancellation.
- Unit tests for follow-up repository create/update/cancel/find behavior.
- Prompt injection tests proving comments cannot force unsupported writes, skip evidence requirements, or bypass pause/follow-up policy.
- E2E/integration-style tests for webhook comments `/status`, `/blocker`, and `/stop`.

Verification commands:
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run lint
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e

Completion report:
- Summarize files added/changed.
- Confirm exact Milestone 4 scope implemented.
- List deferred items.
- Paste the verification results.
```
