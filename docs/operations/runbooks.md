# Operational Runbooks

## 1. Local Verification
**Scenario:** You want to verify the PM agent works locally before pushing.
**Runbook:**
1. Start the server: `npm run start:dev`
2. Run unit tests: `npx jest`
3. Run e2e tests: `$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e`
4. Send a test webhook payload to `http://localhost:3000/webhook`.

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

## 7. Preparing Real GitHub App and Google AI Studio Credentials
**Scenario:** Transitioning from Fake modes to real integrations.
**Runbook:**
1. **GitHub App:** Create a new GitHub App. Generate a private key. Set `GITHUB_APP_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_PRIVATE_KEY` environment variables.
2. **Google AI Studio:** Obtain an API key from Google AI Studio. Set `GEMINI_API_KEY` environment variable.
3. Replace `FakeGithubWriterClient` and `FakeTriageAiClient` in the modules with their real HTTP client implementations.
