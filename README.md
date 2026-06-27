# Ruan AI

Ruan AI is a NestJS GitHub App backend for AI-assisted project management.
It receives GitHub webhooks, validates and normalizes issue events/comments,
calls Google AI Studio through a provider abstraction, applies policy checks,
and writes PM-oriented comments or labels back to GitHub.

## Start Here

For agents and developers:

1. Read `AGENTS.md`.
2. Read `docs/design/00-index.md`.
3. Read `docs/operations/ci-cd.md` before touching branches, releases, or deployment.
4. Read the subsystem design doc for the task.

Do not deploy, change release branches, create release tags, or alter Cloud Run
configuration unless the task explicitly asks for that operational change.

## Current Runtime

- Framework: NestJS 11.
- Deployment target: Cloud Run staging service `ruan-ai-staging`.
- CI/CD config: `cloudbuild.yaml`.
- Staging provider mode: real providers can be enabled through Secret Manager.
- Default local/test mode: fake providers.

## Local Setup

```powershell
npm ci
```

## Verification

Use fake provider mode for normal local checks:

```powershell
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings=0
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e
```

`npm run lint` currently runs ESLint with `--fix`; CI uses check-only ESLint.

## Deployment

Normal deployment is handled by Cloud Build from the configured staging branch.
Manual Cloud Run deployment is reserved for owner-approved emergency rollback or
one-off environment updates.

See:

- `docs/operations/ci-cd.md`
- `docs/operations/cloud-run-staging.md`
- `docs/operations/release-management.md`

## Live Tests

Live integration tests are skipped unless explicitly opted in:

```powershell
$env:RUN_LIVE_INTEGRATION='true'
$env:PROVIDER_MODE='real'
npx jest --config ./test/jest-e2e.json test/live-integration.e2e-spec.ts --runInBand
```

Live write tests are not part of normal CI/CD and require explicit owner
approval plus a disposable issue and label.
