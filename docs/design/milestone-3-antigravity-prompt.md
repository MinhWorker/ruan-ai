# Milestone 3 Antigravity Prompt

Use this prompt after Milestone 2 has been reviewed and committed.

```text
You are working in D:\ai\ruan-ai, a NestJS project for an AI Project Manager GitHub App.

Current baseline:
- Milestone 0 design docs exist in docs/design/.
- Milestone 1 app skeleton is implemented: config, health, webhook signature verification, normalized events, and job state.
- Milestone 2 triage workflow is implemented: AI/client abstractions, context builder, policy validation, fake GitHub reader/writer, fake AI client, and triage workflow tests.
- The webhook-to-job contract now carries repository owner/name and sender login metadata. Do not regress this.

Read these files before coding:
- docs/design/03-github-app-workflows.md
- docs/design/04-system-architecture.md
- docs/design/05-ai-orchestration.md
- docs/design/06-state-and-storage.md
- docs/design/07-security-and-permissions.md
- docs/design/09-roadmap-and-backlog.md
- src/webhook/dto/normalized-event.dto.ts
- src/job/interfaces/job.interface.ts
- src/pm-workflow/services/pm-workflow.service.ts
- src/pm-workflow/services/triage-workflow.service.ts
- src/ai/schemas/triage-output.schema.ts
- src/policy/services/triage-policy.service.ts

Task: implement Milestone 3 from docs/design/09-roadmap-and-backlog.md: Planning And Splitting.

Milestone 3 scope:
- `/plan`
- `/split`
- active plan comment markers
- task handoff output
- dependency and parallelism wording
- invalid-output repair retry

Hard constraints:
- Do not implement real Google AI Studio calls yet unless the repo already has a configured provider boundary for it. Keep deterministic fake AI implementations for tests.
- Do not implement real GitHub App auth/REST writes yet. Extend existing GithubClient/GithubWriter interfaces and fake implementations.
- Do not implement `/status`, `/blocker`, `/stop`, dashboards, database persistence, PR review automation, or direct coding-agent execution.
- Do not run long workflow logic inside the webhook HTTP request path.
- Treat issue bodies and comments as untrusted data.
- Structured AI output must be schema-validated before policy or GitHub writes.
- App comments must use hidden markers and upsert semantics.
- Existing triage tests must continue passing.

Expected architecture:
1. Extend command routing
   - `issue_comment.created` with `/plan` routes to planning workflow.
   - `issue_comment.created` with `/split` routes to task splitting workflow.
   - If both commands appear, handle only the first recognized command in textual order and document/test the behavior.
   - Unsupported slash commands should not fail the job; return/help through the writer only if an existing contract supports it cleanly.

2. Add planning workflow
   - Build a bounded planning context from issue title/body, current labels, recent comments if available through the fake GitHub client, prior app triage/plan comment if available, and repository config/defaults.
   - Define strict `PlanOutput` schema.
   - Output fields should include problem statement, scope, non-scope, dependencies, task sequence, acceptance criteria, verification strategy, human decisions, confidence, assumptions, and evidence.
   - If requirements are underspecified, the output must ask direct human questions and must not fabricate a complete implementation plan.
   - Upsert an active plan comment with a hidden marker, e.g. `<!-- ruan-ai:workflow=plan issue=N logical=active-plan version=1 -->`.

3. Add task splitting workflow
   - Define strict `SplitOutput` schema.
   - Output dependency-ordered coding-agent tasks.
   - Each task must include title, objective, files/areas to inspect, allowed operations, dependencies, parallelization guidance, verification commands, completion evidence, and owner type: `human`, `coding_agent`, or `blocked`.
   - If tasks can run in parallel, say exactly which task IDs can run in parallel.
   - If tasks share files/state, serialize them explicitly.
   - Upsert split/handoff comment with a hidden marker.

4. Add invalid-output repair retry
   - For plan and split only, if schema validation fails, call the AI client once more through a repair method.
   - Repair prompt/input must include only the validation errors and a non-sensitive context summary.
   - If repair also fails, mark the job failed or waiting_human according to existing job semantics and write no GitHub state from invalid output.

5. Extend policy
   - Validate comments are non-empty and safe.
   - Validate workflow transitions are allowed.
   - Validate task handoff output does not authorize direct repository mutation beyond writing comments/labels through existing writer.
   - Validate labels/project writes only if this milestone explicitly needs them; otherwise keep plan/split comment-only.

Testing requirements:
- Unit tests for command routing from comment events to `/plan` and `/split`.
- Unit tests for `PlanOutput` schema validation, including rejection of unexpected fields.
- Unit tests for `SplitOutput` schema validation, including dependency references and owner type values.
- Unit tests for repair retry success and repair retry failure.
- Unit tests for active plan marker/upsert behavior.
- Prompt injection tests proving issue/comment text cannot override schema, policy, labels, or command routing.
- E2E/integration-style tests for webhook comment `/plan` and `/split` creating jobs and executing the fake workflow path.

Verification commands:
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run lint
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e

Completion report:
- Summarize files added/changed.
- Confirm exact Milestone 3 scope implemented.
- List deferred items.
- Paste the verification results.
```
