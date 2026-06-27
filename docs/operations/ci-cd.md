# CI/CD

## Current Pipeline

The repository is prepared for Cloud Run continuous deployment through Cloud Build.

Build config:

- `cloudbuild.yaml`

The pipeline behaves like a Vercel production deployment gate:

1. install dependencies with `npm ci`,
2. compile the NestJS app,
3. run ESLint in check-only mode,
4. run unit tests,
5. run e2e tests,
6. build and push a Docker image to Artifact Registry,
7. deploy the exact image tag to Cloud Run,
8. smoke check `/health`.

The pipeline does not run live write tests. Live write tests require explicit owner approval and a disposable issue.

## Cloud Build Trigger

Recommended trigger:

- Event: push to branch
- Branch: `staging`
- Build config: `cloudbuild.yaml`
- Service account: a dedicated Cloud Build deploy service account, not an owner user account

Required IAM for the Cloud Build service account:

- `roles/run.admin`
- `roles/artifactregistry.writer`
- `roles/iam.serviceAccountUser` on the Cloud Run runtime service account

The Cloud Run runtime service account still needs `roles/secretmanager.secretAccessor` on:

- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GOOGLE_AI_STUDIO_API_KEY`

## Branch Strategy

Use a small environment branch model:

| Branch | Purpose | Deploy behavior |
| --- | --- | --- |
| `main` | official release source | protected; deploy only after a reviewed release decision |
| `staging` | Cloud Run staging/pilot | auto-deploy through Cloud Build after checks pass |
| `develop` | integration branch for agent work | CI only; no deploy by default |
| `codex/*`, `agy/*` | short-lived work branches | CI only; merge into `develop` or `staging` after review |

Recommended flow:

1. Agents work on `codex/*` or `agy/*`.
2. Merge reviewed work into `develop`.
3. Promote `develop` to `staging` when ready for live pilot.
4. Promote `staging` to `main` for official releases.

For this early project, it is acceptable to temporarily connect Cloud Build to `codex/milestone-1-checkpoint`, but switch to `staging` before letting multiple agents work concurrently.

The release and deployment rules are defined in `docs/operations/release-management.md`.

## Versioning

Use tags for official releases:

- `v0.1.0` for first usable pilot,
- `v0.2.0` for next feature release,
- patch tags such as `v0.1.1` for fixes.

Keep Cloud Run revision names as deployment history, but treat Git tags as the official application version history.
