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
2. Review `model_error` telemetry and its `failureCategory`:
   `provider_rate_limit`, `provider_model_unavailable`,
   `provider_auth_failure`, `provider_timeout`,
   `provider_invalid_json`, or `provider_error`.
3. If rate-limited, pause or reduce background processing before retrying.
4. If the model is unavailable, verify the configured model ID in the approved
   environment/configuration path. Do not change model IDs without owner review.
5. If authentication fails, verify the secret binding and provider account
   outside GitHub issue comments. Do not paste keys into logs, issues, or chat.
6. Review `rate_limit` telemetry to understand request volume.

## 4. Invalid AI Output Repair Failures

**Scenario:** Telemetry shows repeated `validation_failure` events and jobs are failing.
**Runbook:**

1. Inspect validation error summaries and workflow names in telemetry; do not
   log or copy full prompts, raw credentials, or unredacted model context.
2. Review whether the repair attempt produced `provider_invalid_json` or a
   second schema validation failure.
3. If the model consistently fails to produce valid JSON schema, propose a
   model/profile change through the normal owner-reviewed configuration flow.
4. Update prompt or schema instructions only after adding fixture coverage for
   the failing workflow.

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
4. Review `github_write` telemetry for the failed action (`apply_labels`,
   `create_comment`, `update_comment`, or `upsert_comment`) and the affected
   repository/issue. Error metadata is redacted by `TelemetryService`.

## 8a. GitHub Write Failures

**Scenario:** AI output passed policy, but labels or comments were not written.
**Runbook:**

1. Query `github_write` telemetry for events with `severity=error`.
2. Check the `action`, `repositoryOwner`, `repositoryName`, and `issueNumber`
   fields to identify the failed write.
3. For label failures, verify the label exists in the repository and the GitHub
   App has issue write permissions.
4. For comment failures, verify the app installation can read and write issue
   comments and that the target issue still exists.
5. Retry only after confirming the previous marker/upsert behavior will avoid
   duplicate comments.

## 9. Provider Mode Configuration Errors

**Scenario:** App crashes on startup complaining about missing configuration.
**Runbook:**

1. Check `PROVIDER_MODE` environment variable.
2. If `PROVIDER_MODE=real`, ensure all required real-mode configuration (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GOOGLE_AI_STUDIO_API_KEY`) is set.
3. Review `.env` and compare with `.env.example`.

## 10. Provider Configuration Failures

**Scenario:** Job fails fast and telemetry shows `provider_resolution_failure` or `provider_auth_failure`. For explicit command workflows, a generic comment may be posted to GitHub indicating AI provider configuration is missing or invalid. Background event workflows should record telemetry and avoid noisy comments unless a future policy explicitly allows them.
**Runbook:**

1. Check the `ProviderConfig` database records for the specific `installationId` and `repositoryId`.
2. If the configuration is missing, instruct the repository administrator to configure their AI provider.
3. If using AI Studio, verify the Secret Manager reference exists and the application has `Secret Manager Secret Accessor` IAM permissions for that specific secret.
4. If using Google Cloud Gemini Enterprise Agent Platform API (formerly Vertex AI), verify the `project`, `location`, and Workload Identity Federation / service account impersonation settings are correct. Ensure the service account has the necessary Google Cloud AI permissions. If a static service account JSON key is used as a legacy fallback, verify it is stored only in Secret Manager and has explicit owner approval.
5. Check if the app-level fallback is disabled or missing while the repository lacks explicit configuration.
