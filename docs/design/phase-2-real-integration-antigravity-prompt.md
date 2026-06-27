# Phase 2 Real Integration Antigravity Prompt

Use this prompt after Milestone 5 has been reviewed and committed.

```text
You are working in D:\ai\ruan-ai, a NestJS project for an AI Project Manager GitHub App.

Current baseline:
- Milestones 1-5 are implemented and verified.
- The app has PM workflows, fake GitHub/AI boundaries, policy validation, telemetry/audit/rate-limit ops endpoints, and operational runbooks.
- The roadmap MVP feature surface is complete at fake-provider level.

Task: prepare the app for real-provider integration without implementing deferred product features.

Scope:
- GitHub App authentication/read/write client implementation behind the existing GithubClient and GithubWriter abstractions.
- Google AI Studio provider implementation behind the existing AiClient abstraction.
- Model availability validation against the configured provider boundary.
- Environment configuration, validation, and `.env.example`.
- Integration test strategy using fakes by default and live tests gated behind explicit environment flags.
- Documentation for credentials and local webhook testing.

Hard constraints:
- Do not implement PR review workflow, release notes, GitHub Action companion, project board dashboards, direct coding-agent execution, multi-repository planning, browser/IDE integration, MCP hosting, or frontend dashboards.
- Do not make live GitHub or Google calls in normal unit/e2e tests.
- Live integration tests must be skipped unless an explicit opt-in env var is set.
- Never log or store secrets. Telemetry/audit must continue redacting secret-like strings.
- Keep existing fake providers as the default for local tests.
- Preserve existing tests and ops endpoints.

Expected work:
1. Configuration
   - Add validated env fields for:
     - GitHub App ID,
     - GitHub App private key,
     - webhook secret,
     - optional GitHub installation ID for live tests,
     - Google AI Studio API key,
     - primary model ID,
     - fallback model ID,
     - provider mode: `fake` or `real`.
   - Add `.env.example` with placeholders only.
   - Update config tests.

2. GitHub provider
   - Add real GitHub client/writer classes implementing existing interfaces.
   - Use GitHub App installation auth.
   - Implement repository metadata, issue reads, comments reads, label discovery, apply labels, and marker-based upsert comment.
   - Keep fake provider as default in tests.
   - Add unit tests around auth/request adapter seams using mocks.

3. Google AI provider
   - Add real AI client implementing existing triage/plan/split/status/blocker/repair methods.
   - Use strict JSON-only response handling and existing schema validators.
   - Route model profiles according to docs/design/05-ai-orchestration.md.
   - Add timeout and single repair retry behavior without duplicating workflow-level validation logic.
   - Add provider unit tests using mocked HTTP/client adapter.

4. Provider selection
   - Wire modules to select fake vs real providers by config.
   - Fail fast when provider mode is `real` but required credentials are missing.
   - Keep provider mode `fake` usable without secrets.

5. Model availability
   - Update ModelAvailabilityService to validate configured model IDs through the selected AI provider boundary.
   - Do not hard-code real model IDs as valid.
   - Surface fallback model status in `/ops/model-availability`.

6. Documentation
   - Add docs for creating a GitHub App, required permissions, webhook setup, local tunnel testing, and Google AI Studio key/model configuration.
   - Document exact env vars and live-test opt-in commands.
   - Update runbooks if new operational failure modes are introduced.

Testing requirements:
- Unit tests for config validation.
- Unit tests for provider selection.
- Unit tests for GitHub auth/request adapter behavior using mocks.
- Unit tests for AI provider JSON parsing/error paths using mocks.
- Unit tests proving fake mode needs no credentials.
- Unit tests proving real mode fails fast without required credentials.
- E2E tests should remain fake-mode by default.
- Optional live integration tests must be skipped unless `RUN_LIVE_INTEGRATION=true`.

Verification commands:
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run lint
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand
- $env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e

Completion report:
- Summarize files added/changed.
- State whether real mode is implemented, mocked, or gated.
- List required credentials still needed from the project owner.
- Paste verification results.
```
