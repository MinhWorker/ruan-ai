# Contributing

This repository uses an issue-first and pull-request-first workflow.

## Golden Rules

- Start every non-trivial change from a GitHub issue.
- Use short-lived branches.
- Open a pull request for review before merging into shared branches.
- Do not deploy from a work branch.
- Do not push directly to `main`.
- Do not create release tags unless the project owner approves a release.
- Do not run live write tests unless the project owner explicitly approves them.

## Workflow

1. Create or select an issue.
2. Confirm scope, acceptance criteria, and non-goals in the issue.
3. Create a branch from the intended base:
   - `codex/<issue-number>-short-slug` for Codex work,
   - `agy/<issue-number>-short-slug` for Antigravity work,
   - `docs/<issue-number>-short-slug` for docs-only changes.
4. Implement the smallest coherent change that satisfies the issue.
5. Run verification locally.
6. Open a PR and link it to the issue with `Closes #N` or `Refs #N`.
7. Wait for review before merging into `develop`, `staging`, or `main`.

## Branch Model

| Branch | Purpose | Merge policy |
| --- | --- | --- |
| `develop` | integration branch | PR only |
| `staging` | Cloud Run staging deployment branch | PR only; owner-approved promotion |
| `main` | official release source | PR only; protected; owner-approved release |
| `codex/*`, `agy/*`, `docs/*` | work branches | short-lived |

`staging` is the only branch currently connected to Cloud Run auto-deploy.
Pushing to `staging` triggers Cloud Build through `cloudbuild.yaml`.

## Pull Request Requirements

Every PR must include:

- linked issue,
- summary of changes,
- scope and non-goals,
- verification evidence,
- deployment impact,
- live write test status.

Docs-only PRs may skip runtime tests if the PR clearly states why.

## Verification

For backend behavior changes, run:

```powershell
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings=0
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand
$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e
```

## Release And Deployment

Read `docs/operations/release-management.md` before touching deployment,
release branches, tags, Cloud Run, Cloud Build, IAM, or Secret Manager.

Normal flow:

```text
issue -> work branch -> PR -> develop -> PR -> staging -> Cloud Run staging
```

Official release flow:

```text
staging -> owner-approved PR -> main -> owner-approved tag
```
