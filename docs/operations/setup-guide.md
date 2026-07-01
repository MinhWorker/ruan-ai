# Setup Guide for Real Integration

## Credential Checklist for Project Owner

Before running the application in real mode, the project owner must provision and provide the following:

- [ ] **Google AI Studio API Key**: An active key from aistudio.google.com.
- [ ] **Google AI Studio Model IDs**: Primary and fallback model IDs. **Note:** The project owner MUST verify current Google AI Studio availability and free-tier limits before selecting these IDs. Do not copy model IDs from unrelated examples without verification.
- [ ] **GitHub App ID**: From the created GitHub App.
- [ ] **GitHub App Private Key**: A `.pem` file or the raw string of the private key.
- [ ] **GitHub Webhook Secret**: The secret used to verify webhook payloads.
- [ ] **GitHub Live Target Repository**: `GITHUB_LIVE_OWNER` and `GITHUB_LIVE_REPO` for live integration testing.
- [ ] **GitHub Live Write Target**: `GITHUB_LIVE_ISSUE_NUMBER` and `GITHUB_LIVE_LABEL` for write tests only. Use a disposable test issue and an existing test label.

## Creating a GitHub App

1. Go to your GitHub account settings or organization settings -> Developer settings -> GitHub Apps -> New GitHub App.
2. Set a name and homepage URL.
3. **Webhook Setup:**
   - For local development, use a local tunnel (e.g., `smee.io` or `ngrok`).
   - Webhook URL: `https://<your-tunnel-url>/github/webhooks`
   - Webhook Secret: Generate a strong secret.
4. **Permissions:**
   - **Issues:** Read & write
   - **Pull requests:** Read-only
   - **Metadata:** Read-only (mandatory)
5. **Subscribe to Events:**
   - Issue comment
   - Issues
6. Create the App.
7. Generate a **Private Key** and download the `.pem` file.
8. Note the **App ID**.

## AI Provider Setup

Ruan AI supports both a single-tenant fallback mode (using an app-level API key) and a multi-tenant, repository-scoped configuration mode.

**For single-tenant / simple setup (Google AI Studio only):**

1. Go to Google AI Studio (aistudio.google.com).
2. Get an API key.
3. This key will be set as the `GOOGLE_AI_STUDIO_API_KEY` environment variable.

**For multi-repository setups (Google AI Studio and Google Cloud Gemini Enterprise Agent Platform API):**

- Provider configuration is resolved per repository or installation.
- Real secrets must be stored securely in an external secret store (e.g., Google Cloud Secret Manager).
- The application database stores configuration properties and Secret Manager references.
- Secrets must **never** be checked into repository `.ruan-ai.yml` files, posted in GitHub issues, or stored as plain text in the application database.
- Google Cloud Gemini Enterprise Agent Platform API (formerly Vertex AI) requires Workload Identity Federation or service account impersonation, not just an API key. Static service account JSON keys are a last-resort legacy option only and must require explicit owner approval plus Secret Manager storage.

## Environment Variables

Create a `.env` file in the root of the project with the following (see `.env.example`):

```env
PROVIDER_MODE=real
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
# Optional: specific installation to bind to
GITHUB_INSTALLATION_ID=your_installation_id
GOOGLE_AI_STUDIO_API_KEY=your_gemini_api_key
PRIMARY_MODEL_ID=your-primary-google-ai-studio-model-id
FALLBACK_MODEL_ID=your-fallback-google-ai-studio-model-id
```

Use the exact model IDs selected for this project after verifying current Google AI Studio availability and free-tier limits. Do not copy model IDs from unrelated examples.

## Local Tunnel Testing

If you are running locally:

1. Use `smee`: `npx smee-client --url https://smee.io/YOUR_URL --target http://localhost:3000/webhook`
2. Start the server: `npm run start:dev`
3. Webhook events triggered in the installed repository will flow to your local server.

## Live-Test Opt-in Commands

When testing the PM Agent on a live issue, you can use the following commands in an issue comment to manually trigger workflows if they are wired up:

- `@ruangm-ai /plan`
- `@ruangm-ai /split`
- `@ruangm-ai /status`
- `@ruangm-ai /blocker`
- `@ruangm-ai /stop`

Ensure `PROVIDER_MODE=real` to actually perform live actions on GitHub and generate responses from Google AI Studio.

## Running Live Integration Tests (Skipped by default)

To run the live integration tests that verify GitHub and Google AI connectivity, ensure your `.env` contains all required live variables and run:

```powershell
$env:RUN_LIVE_INTEGRATION="true"; $env:PROVIDER_MODE="real"; npx jest test/live-integration.e2e-spec.ts
```

To also test live write operations to GitHub (Caution: This modifies the test repository):

```powershell
$env:RUN_LIVE_INTEGRATION="true"; $env:RUN_LIVE_WRITE_TESTS="true"; $env:PROVIDER_MODE="real"; $env:GITHUB_LIVE_ISSUE_NUMBER="123"; $env:GITHUB_LIVE_LABEL="ruan-ai-test"; npx jest test/live-integration.e2e-spec.ts
```

Live write tests require a disposable issue number and an existing label. They intentionally do not default to issue `#1` or label `bug`.

## Rollback to Fake Mode

If you encounter issues with live credentials or rate limits, you can always rollback to fake mode, which requires no credentials:

1. Update your `.env` or environment to set `PROVIDER_MODE=fake`.
2. Restart the application.
3. The app will now use mocked providers for GitHub and Google AI operations.
