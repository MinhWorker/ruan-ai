# Phase 3 Live Pilot Antigravity Prompt

Use this prompt only after Phase 2 real integration and live hardening have been reviewed.

```text
You are working in D:\ai\ruan-ai, a NestJS project for an AI Project Manager GitHub App.

Current baseline:
- Fake-mode MVP workflows are implemented and verified.
- Real GitHub provider uses Octokit behind GithubClient/GithubWriter.
- Real Google AI Studio provider uses @google/genai behind AiClient.
- Live integration tests are skipped by default and gated by RUN_LIVE_INTEGRATION=true.
- Live write tests are additionally gated by RUN_LIVE_WRITE_TESTS=true and require explicit GITHUB_LIVE_ISSUE_NUMBER and GITHUB_LIVE_LABEL.

Task: perform a credential-backed live pilot readiness pass. Do not add deferred product features.

Precondition:
- If the project owner has not provided real credentials and model IDs, stop and report exactly which env vars are missing.
- Do not invent credentials, model IDs, repository names, labels, issue numbers, or live-test results.

Required env vars for read-only live pilot:
- PROVIDER_MODE=real
- GITHUB_WEBHOOK_SECRET
- GITHUB_APP_ID
- GITHUB_APP_PRIVATE_KEY
- GITHUB_LIVE_OWNER
- GITHUB_LIVE_REPO
- GOOGLE_AI_STUDIO_API_KEY
- PRIMARY_MODEL_ID
- FALLBACK_MODEL_ID

Additional env vars for write pilot:
- RUN_LIVE_WRITE_TESTS=true
- GITHUB_LIVE_ISSUE_NUMBER
- GITHUB_LIVE_LABEL

Scope:
1. Read-only live smoke
   - Run the live integration test suite with RUN_LIVE_INTEGRATION=true.
   - Verify GitHub App installation auth can read repository metadata.
   - Verify repository labels and issue comments can be read.
   - Verify primary and fallback Google AI Studio model IDs are available.
   - Capture sanitized results only. Never print private keys or API keys.

2. Optional write smoke
   - Run only if the owner explicitly provides RUN_LIVE_WRITE_TESTS=true, GITHUB_LIVE_ISSUE_NUMBER, and GITHUB_LIVE_LABEL.
   - Upsert only the hidden-marker test comment used by the live test.
   - Apply only the owner-provided existing test label.
   - Confirm the marker can be read back.

3. Fix only live-readiness bugs
   - If live tests fail due to auth, model availability, permissions, pagination, config loading, or provider adapter bugs, fix those.
   - Keep fixes narrowly scoped.
   - Do not implement PR review, release notes, GitHub Action companion, dashboards, project boards, coding-agent execution, multi-repository planning, browser/IDE integration, or MCP hosting.

4. Documentation
   - Update setup-guide/runbooks only when actual live pilot behavior differs from the documented flow.
   - Add troubleshooting notes for any real failure encountered.

Verification commands after any code change:
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run lint
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e

Completion report:
- State whether read-only live pilot was run, skipped, or blocked.
- State whether write pilot was run, skipped, or blocked.
- List sanitized live-test results.
- List any remaining credentials/resources needed from the project owner.
- Paste local verification results after any code changes.
```
