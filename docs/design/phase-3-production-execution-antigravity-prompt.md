# Phase 3 Production Job Execution Antigravity Prompt

Use this prompt after the real provider integration and read-only live pilot have passed.

```text
You are working in D:\ai\ruan-ai, a NestJS project for an AI Project Manager GitHub App.

Current verified baseline:
- The app is deployed to Cloud Run staging at https://ruan-ai-staging-309117600688.us-central1.run.app.
- PROVIDER_MODE=real is configured for Cloud Run staging.
- GitHub App credentials, webhook secret, and Google AI Studio key are stored in Google Secret Manager.
- Read-only live integration has passed for the configured pilot repository.
- Signed webhook ingress on Cloud Run has passed and returns 202 Accepted.
- Important limitation: the production webhook handler currently creates queued jobs only. Existing e2e tests manually call PmWorkflowService.processJob(job). Cloud Run does not yet execute queued jobs end-to-end after webhook receipt.

Task:
Implement the production job execution path for queued webhook jobs so the deployed GitHub App can handle MVP issue/comment workflows end-to-end. Keep the implementation narrow and pilot-ready.

Do not implement deferred product features:
- PR review workflow,
- release notes,
- GitHub Action companion,
- project board dashboards,
- direct coding-agent execution,
- multi-repository portfolio planning,
- browser/IDE integration,
- MCP tool hosting.

Design constraints:
1. Preserve the existing module boundaries:
   - WebhookController verifies/dedupes/normalizes and creates jobs.
   - PmWorkflowService routes and executes workflow handlers.
   - GithubClient/GithubWriter remain provider abstractions.
   - PolicyService remains the write-safety gate.
2. Do not add a database in this phase.
3. Do not introduce external queue infrastructure in this phase.
4. Keep Cloud Run scale-to-zero viable.
5. Keep duplicate delivery idempotency.
6. Keep fake provider tests deterministic.
7. Do not print or store secrets in logs, telemetry, comments, or test output.

Implementation requirements:
1. Add an execution mode config.
   - Add an env var such as JOB_EXECUTION_MODE with allowed values:
     - inline: process supported jobs after enqueue in the same request, with bounded execution and existing idempotency.
     - queued: current behavior, enqueue only.
   - Default should be queued unless tests or docs explicitly opt into inline.
   - Validate invalid values fail fast.

2. Add a production-safe execution service.
   - Create a small service such as JobExecutionService or WorkflowExecutionService.
   - It should accept a created Job and call PmWorkflowService.processJob(job) when execution mode is inline.
   - It should mark failed jobs as failed if processJob throws.
   - It should not retry infinitely.
   - It should log and emit telemetry for:
     - execution started,
     - execution completed,
     - execution failed,
     - execution skipped because mode is queued.

3. Wire webhook to execution mode.
   - After WebhookController creates a new accepted job, trigger the execution service.
   - Duplicate deliveries must still return duplicate and must not re-execute.
   - Ignored events must not execute.
   - Unsupported commands that create comment.unsupported jobs should be handled consistently by the execution service when inline mode is enabled.

4. Protect HTTP behavior.
   - Keep HTTP status semantics:
     - invalid signature: 401,
     - missing delivery: 400,
     - ignored event: 202 ignored,
     - accepted job: 202 accepted,
     - duplicate: 202 duplicate.
   - If inline execution fails after the webhook was accepted, return 202 with an accepted response plus execution status metadata, or keep the response shape compatible and record failure through job/telemetry.
   - Do not expose stack traces or secret-bearing error messages in HTTP responses.

5. Add tests.
   - Unit tests for config validation of JOB_EXECUTION_MODE.
   - Unit tests for the new execution service:
     - queued mode skips,
     - inline mode calls PmWorkflowService.processJob,
     - thrown execution marks job failed and records telemetry/log behavior where practical.
   - Webhook e2e/integration tests:
     - signed issues.opened webhook in queued mode creates job but does not execute workflow.
     - signed issues.opened webhook in inline mode executes the fake triage workflow without manually calling processJob.
     - duplicate delivery in inline mode does not execute twice.
     - issue_comment /plan or /status in inline mode executes the fake workflow path where existing fake clients support it.

6. Documentation.
   - Update docs/operations/cloud-run-staging.md with real-mode env vars and JOB_EXECUTION_MODE.
   - Update docs/operations/runbooks.md with how to diagnose jobs accepted but not executed.
   - Document that live write pilot requires explicit owner approval and a test issue.

Verification commands:
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run lint
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e

Do not run live write tests unless the project owner explicitly provides:
- RUN_LIVE_WRITE_TESTS=true
- GITHUB_LIVE_ISSUE_NUMBER
- GITHUB_LIVE_LABEL

Completion report:
- List files added/changed.
- State the final JOB_EXECUTION_MODE behavior and default.
- State whether webhook e2e now proves automatic execution.
- Include exact verification results.
- List any remaining manual deployment steps.
```
