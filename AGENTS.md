# Agent Instructions

This file is the entrypoint for coding agents and human contributors working in
this repository.

## Required Reading

Before editing code or docs:

1. `docs/design/00-index.md`
2. `docs/design/08-agent-execution-guide.md`
3. `docs/operations/ci-cd.md`
4. `docs/operations/release-management.md`
5. `docs/operations/github-workflow.md`
6. The subsystem design document relevant to the task

## Deployment Guardrails

Do not deploy unless the task explicitly asks for deployment.

Do not run these commands without explicit owner approval:

- `gcloud run deploy`
- `gcloud run services update`
- `gcloud builds submit`
- `gcloud builds triggers run`
- any command that changes Cloud Run traffic, runtime env vars, secrets, or IAM

Do not edit `cloudbuild.yaml` unless the task is about CI/CD or deployment.

Do not change `JOB_EXECUTION_MODE`, `PROVIDER_MODE`, model IDs, webhook URLs, or
Secret Manager bindings unless the task explicitly asks for it.

## Branch And Release Guardrails

Do not push directly to `main`.

Do not create, move, or delete release tags such as `v0.1.0` unless the task is
an owner-approved release.

Use short-lived work branches:

- `codex/*` for Codex work,
- `agy/*` for Antigravity work,
- `docs/*` for documentation-only work,
- `ops/*` for operations work,
- other task-specific branches only when requested.

The intended branch model is:

- `develop`: integration branch, CI only.
- `staging`: Cloud Run staging deployment branch.
- `main`: protected official release source.

## Scope Guardrails

The MVP is an AI Project Manager GitHub App. It must not expand into these
features unless a future design doc or ADR explicitly approves them:

- direct coding-agent execution,
- PR review automation,
- release-note automation,
- GitHub Actions companion,
- project board dashboards,
- multi-repository portfolio planning,
- browser/IDE integration,
- MCP tool hosting.

## Verification Expectations

Before handing off code changes, run the narrowest meaningful checks. For broad
backend changes, run:

```powershell
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings=0
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e
```

Report any skipped checks and why they were skipped.

## Secrets

Never print, commit, store, or echo real values for:

- GitHub webhook secrets,
- GitHub App private keys,
- Google AI Studio API keys,
- Cloud service account credentials.

Use Secret Manager references in docs and deployment configs.
