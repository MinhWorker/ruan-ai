# Cloud Run Deployment Guide - Staging

## Overview

This document covers deploying **ruan-ai** to Google Cloud Run for the staging/pilot service.
The service can run either fake providers (`PROVIDER_MODE=fake`) for infrastructure smoke tests or real providers (`PROVIDER_MODE=real`) for the GitHub App pilot.

## Prerequisites

| Requirement | Value |
|---|---|
| Google Cloud Project | `gen-lang-client-0591588109` |
| Region | `us-central1` |
| Required APIs | Cloud Run, Cloud Build, Artifact Registry, Secret Manager |
| Local tools | `gcloud` CLI authenticated, Docker (for local build verification) |

Confirm APIs are enabled:

```bash
gcloud services list --enabled --project=gen-lang-client-0591588109 \
  | grep -E 'run|cloudbuild|artifactregistry|secretmanager'
```

## Secrets Setup

Store secrets in Secret Manager. Never put secret values in the repository or Docker image.

```powershell
# Create the webhook secret
"YOUR_WEBHOOK_SECRET_VALUE" | gcloud secrets create GITHUB_WEBHOOK_SECRET `
  --project=gen-lang-client-0591588109 `
  --replication-policy=automatic `
  --data-file=-
```

To update an existing secret:

```powershell
"NEW_VALUE" | gcloud secrets versions add GITHUB_WEBHOOK_SECRET `
  --project=gen-lang-client-0591588109 `
  --data-file=-
```

Grant the Cloud Run runtime service account permission to read the secret:

```powershell
gcloud secrets add-iam-policy-binding GITHUB_WEBHOOK_SECRET `
  --project=gen-lang-client-0591588109 `
  --member="serviceAccount:309117600688-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

Real-provider pilot mode also requires:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GOOGLE_AI_STUDIO_API_KEY`

Grant the same runtime service account `roles/secretmanager.secretAccessor` for each secret.

## Local Docker Build Verification

```powershell
# Build the image
docker build -t ruan-ai:staging .

# Run locally (mimics Cloud Run environment)
docker run --rm -p 8080:8080 `
  -e PORT=8080 `
  -e GITHUB_WEBHOOK_SECRET=test-secret `
  -e PROVIDER_MODE=fake `
  ruan-ai:staging

# Verify health endpoint
curl http://localhost:8080/health
```

## Deploy to Cloud Run (Fake Provider Smoke)

### One-command deploy (source-based)

Cloud Build will build the Docker image and deploy to Cloud Run in a single step:

```powershell
gcloud run deploy ruan-ai-staging `
  --project=gen-lang-client-0591588109 `
  --region=us-central1 `
  --source=. `
  --set-env-vars=PROVIDER_MODE=fake `
  --set-secrets=GITHUB_WEBHOOK_SECRET=GITHUB_WEBHOOK_SECRET:latest `
  --allow-unauthenticated `
  --port=8080 `
  --memory=512Mi `
  --cpu=1 `
  --min-instances=0 `
  --max-instances=2 `
  --timeout=300
```

## Update Cloud Run to Real Provider Pilot

Use this after the GitHub App, private key, webhook secret, Google AI Studio key, and model IDs are configured.

```powershell
gcloud run services update ruan-ai-staging `
  --project=gen-lang-client-0591588109 `
  --region=us-central1 `
  --set-env-vars=PROVIDER_MODE=real,GITHUB_LIVE_OWNER=MinhWorker,GITHUB_LIVE_REPO=ruan-ai,PRIMARY_MODEL_ID=gemma-4-31b-it,FALLBACK_MODEL_ID=gemma-4-26b-a4b-it,JOB_EXECUTION_MODE=inline,AI_MODEL_TIMEOUT_MS=120000 `
  --update-secrets=GITHUB_WEBHOOK_SECRET=GITHUB_WEBHOOK_SECRET:latest,GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_APP_PRIVATE_KEY=GITHUB_APP_PRIVATE_KEY:latest,GOOGLE_AI_STUDIO_API_KEY=GOOGLE_AI_STUDIO_API_KEY:latest
```

Current pilot values:

- service URL: `https://ruan-ai-staging-309117600688.us-central1.run.app`
- webhook URL: `https://ruan-ai-staging-309117600688.us-central1.run.app/github/webhooks`
- primary model: `gemma-4-31b-it`
- fallback model: `gemma-4-26b-a4b-it`
- job execution mode: `inline` (executes queued jobs immediately in the same request)

Note: `JOB_EXECUTION_MODE=queued` (default) will accept and queue the webhook but will not execute it. Set to `inline` to execute workflows.

For automated deployments, use the Cloud Build pipeline in `cloudbuild.yaml`. The manual command above remains useful for emergency rollback or one-off environment variable changes.

### What each flag does

| Flag | Purpose |
|---|---|
| `--source=.` | Builds image via Cloud Build using the Dockerfile |
| `--set-env-vars=PROVIDER_MODE=fake` | Fake-provider smoke mode uses no live GitHub/Gemini calls |
| `--set-secrets=GITHUB_WEBHOOK_SECRET=GITHUB_WEBHOOK_SECRET:latest` | Mounts the Secret Manager secret as an env var |
| `--allow-unauthenticated` | Allows GitHub webhook POST requests without IAM auth |
| `--port=8080` | Tells Cloud Run which port the container listens on |
| `--min-instances=0` | Scales to zero when idle (cost optimization for staging) |
| `--max-instances=2` | Limits scaling for staging |

## Post-Deploy Verification

```powershell
# Get the service URL
$SERVICE_URL = gcloud run services describe ruan-ai-staging `
  --project=gen-lang-client-0591588109 `
  --region=us-central1 `
  --format='value(status.url)'

echo $SERVICE_URL

# Health check
curl ${SERVICE_URL}/health

# Verify webhook endpoint responds (expects POST with signature)
curl -X POST ${SERVICE_URL}/github/webhooks `
  -H "Content-Type: application/json" `
  -d '{}' -v
```

## Webhook Configuration

After deployment, configure the GitHub App/repo webhook:

- **Webhook URL**: `https://<cloud-run-url>/github/webhooks`
  - Current staging URL: `https://ruan-ai-staging-309117600688.us-central1.run.app/github/webhooks`
- **Content type**: `application/json`
- **Secret**: Same value stored in `GITHUB_WEBHOOK_SECRET` Secret Manager secret

## Architecture Notes

```
GitHub --webhook POST--> Cloud Run (ruan-ai-staging)
                              │
                              ├── PORT=8080 (injected by Cloud Run)
                              ├── PROVIDER_MODE=fake or real
                              ├── GITHUB_WEBHOOK_SECRET (from Secret Manager)
                              ├── GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY (real mode)
                              └── GOOGLE_AI_STUDIO_API_KEY (real mode)
```

- No database or queue is provisioned for staging.
- `PROVIDER_MODE=fake` stubs all external API calls.
- `PROVIDER_MODE=real` uses the configured GitHub App and Google AI Studio credentials.
- `JOB_EXECUTION_MODE=inline` triggers end-to-end webhook processing synchronously for MVP features.
- Cloud Run scales to zero when no requests are received.

## Troubleshooting

### View logs

```powershell
gcloud run services logs read ruan-ai-staging `
  --project=gen-lang-client-0591588109 `
  --region=us-central1 `
  --limit=50
```

### Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Container fails to start | Missing `GITHUB_WEBHOOK_SECRET` | Verify secret exists in Secret Manager |
| 503 on first request | Cold start (scale-from-zero) | Retry after a few seconds; set `--min-instances=1` if unacceptable |
| Build fails | Node version mismatch | Dockerfile pins `node:22-alpine`; ensure `package-lock.json` is committed |

## Updating the Deployment

Re-run the same `gcloud run deploy` command. Cloud Build will rebuild the image and perform a rolling update.
For environment variable changes only (no code change):

```powershell
gcloud run services update ruan-ai-staging `
  --project=gen-lang-client-0591588109 `
  --region=us-central1 `
  --set-env-vars=PROVIDER_MODE=fake
```
