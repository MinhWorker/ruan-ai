# Release Management

## Purpose

This document prevents accidental deployment or accidental modification of an
official release. It is binding for humans and coding agents.

## Environments

| Environment      | Branch          | Deployment                       | Notes                         |
| ---------------- | --------------- | -------------------------------- | ----------------------------- |
| Local            | any work branch | none                             | fake providers by default     |
| Integration      | `develop`       | CI only                          | no Cloud Run deployment       |
| Staging/Pilot    | `staging`       | Cloud Build to `ruan-ai-staging` | owner-reviewed promotion only |
| Official release | `main` plus tag | owner-approved release process   | protected source of truth     |

Until branch protection and Cloud Build triggers are fully configured, do not
assume branch names alone enforce safety. Treat this document as the policy.

## Promotion Flow

1. Implement on a short-lived branch such as `codex/*` or `agy/*`.
2. Link the branch to a GitHub issue and open a PR.
3. Review and verify locally.
4. Merge into `develop` for integration.
5. Promote `develop` to `staging` through a PR for the live pilot.
6. Promote `staging` to `main` only for official releases.
7. Create a version tag only after the release decision is approved.

## What Agents Must Not Do

Agents must not:

- deploy from a work branch unless explicitly asked,
- push directly to `main`,
- create release tags,
- change Cloud Run traffic,
- modify production/staging environment variables,
- rotate or overwrite secrets,
- run live write tests,
- change `cloudbuild.yaml` outside CI/CD tasks.

## Approved Deployment Path

Normal deployment path:

1. Cloud Build trigger watches `staging`.
2. `cloudbuild.yaml` runs build, lint, unit tests, e2e tests.
3. Cloud Build builds and pushes the Docker image.
4. Cloud Build deploys the image to Cloud Run.
5. Cloud Build smoke checks `/health`.

Manual deployment is allowed only for:

- owner-approved emergency rollback,
- owner-approved one-off environment update,
- first-time bootstrap before the trigger exists.

## Release Tags

Use semantic version tags for official releases:

- `v0.1.0`
- `v0.1.1`
- `v0.2.0`

Cloud Run revision names are deployment history, not official application
versions.

## Live Write Tests

Live write tests require all of these:

- explicit project owner approval,
- `RUN_LIVE_WRITE_TESTS=true`,
- a disposable test issue number,
- an existing test label,
- confirmation that the target repo is safe for mutation.

Do not run live write tests as part of standard CI/CD.
