# Operational Runbooks

## 1. Local Verification

**Scenario:** You want to verify the PM agent works locally before pushing.
**Runbook:**

1. Start the server: `npm run start:dev`
2. Run unit tests: `npx jest`
3. Run e2e tests: `$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e`
4. Send a test webhook payload to `http://localhost:3000/webhook`.
5. **Live Verification (Optional):** To verify real connectivity to GitHub and Google AI Studio:
   ```powershell
   $env:RUN_LIVE_INTEGRATION="true"
   $env:PROVIDER_MODE="real"
   npx jest test/live-integration.e2e-spec.ts
   ```
6. **Live Write Verification (Optional, mutates GitHub):** Use only a disposable issue and existing test label.
   ```powershell
   $env:RUN_LIVE_INTEGRATION="true"
   $env:RUN_LIVE_WRITE_TESTS="true"
   $env:PROVIDER_MODE="real"
   $env:GITHUB_LIVE_ISSUE_NUMBER="123"
   $env:GITHUB_LIVE_LABEL="ruan-ai-test"
   npx jest test/live-integration.e2e-spec.ts
   ```
   **Note:** Live write tests require explicit owner approval. Ensure you only run these on a disposable issue intended for testing.

## 2. Webhook Signature Failures

**Scenario:** Webhook payloads from GitHub are being rejected with 401 Unauthorized.
**Runbook:**

1. Verify the `GITHUB_WEBHOOK_SECRET` environment variable is set and matches the GitHub App configuration.
2. Check telemetry/logs for the exact header received (`x-hub-signature-256`).
3. Ensure the payload body is not being mutated before the signature validation middleware runs.

## 3. Model Unavailable or Rate-Limited

**Scenario:** `OpsController` reports `modelAvailability.available = false` or `rateLimit.aiModel.degradedState = true`.
**Runbook:**

1. Check Google AI Studio status page.
2. If rate-limited, ensure the background processes are paused or backoff logic is engaging.
3. Switch `configuredModelId` to a fallback model via ops endpoints or configuration update if available.
4. Review telemetry events (`type=rate_limit`) to understand request volume.

## 4. Invalid AI Output Repair Failures

**Scenario:** Telemetry shows repeated `validation_failure` events and jobs are failing.
**Runbook:**

1. Inspect the raw AI output in the logs/telemetry.
2. Review the `repair` model call results.
3. If the model consistently fails to produce valid JSON schema, rollback to a more capable model (e.g., from Flash to Pro).
4. Update the prompt or schema instructions if the API has changed.

## 5. Policy Rejection Investigation

**Scenario:** A valid AI output is being rejected by `TriagePolicyService`.
**Runbook:**

1. View `/ops/events/policy-rejections` to see rejected labels or comment reasons.
2. Ensure the repository's labels are properly synchronized in the local mock/cache.
3. If an allowlist is configured, verify the suggested label is in the allowlist.
4. If a script tag was generated in the comment, investigate for prompt injection.

## 6. Paused Issue/Follow-Up Recovery

**Scenario:** An issue is marked as `paused` via `/stop` and needs to be recovered, or a follow-up is stuck.
**Runbook:**

1. To resume a paused issue, a human must manually triage or instruct the AI to resume via a specific workflow command (future scope). For now, restart the webhook event.
2. For stuck follow-ups, inspect the in-memory `followUpRecords` (or DB in future). Ensure the scheduler is running.

## 7. Jobs Accepted but Not Executed

**Scenario:** The webhook receives a 202 Accepted but the job doesn't seem to process or produce any effects.
**Runbook:**

1. Check the environment variable `JOB_EXECUTION_MODE`. If it is `queued` (or unset, as `queued` is the default), jobs are only created in the database but not executed.
2. If intended for execution, update the deployment to include `JOB_EXECUTION_MODE=inline`.
3. Check the logs for `job_execution_skipped` or `job_execution_failed` telemetry events. A failed job will record the exact reason in the `message`.
4. Ensure the webhook didn't return `status: "ignored"`.

## 8. App Authentication Failures (GitHub)

**Scenario:** App fails to interact with GitHub APIs (401 Unauthorized or 403 Forbidden).
**Runbook:**

1. Check `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` validity.
2. Ensure the GitHub App is actually installed in the target repository (`owner/repo`).
3. If using `GITHUB_INSTALLATION_ID` override, ensure it matches the actual installation ID for the repository.

## 8. Provider Mode Configuration Errors

**Scenario:** App crashes on startup complaining about missing configuration.
**Runbook:**

1. Check `PROVIDER_MODE` environment variable.
2. If `PROVIDER_MODE=real`, ensure all required real-mode configuration (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GOOGLE_AI_STUDIO_API_KEY`) is set.
3. Review `.env` and compare with `.env.example`.
