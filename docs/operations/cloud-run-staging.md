# Cloud Run Deployment Guide - Staging

## Overview

This document covers deploying **ruan-ai** to Google Cloud Run in staging mode (`PROVIDER_MODE=fake`).
The staging deploy validates the container, networking, and webhook ingress without connecting to live GitHub/Gemini APIs.

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

## Deploy to Cloud Run (Staging)

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
  --timeout=60
```

### What each flag does

| Flag | Purpose |
|---|---|
| `--source=.` | Builds image via Cloud Build using the Dockerfile |
| `--set-env-vars=PROVIDER_MODE=fake` | Staging uses fake providers (no live GitHub/Gemini calls) |
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
                              ├── PROVIDER_MODE=fake
                              └── GITHUB_WEBHOOK_SECRET (from Secret Manager)
```

- No database or queue is provisioned for staging.
- `PROVIDER_MODE=fake` stubs all external API calls.
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
