# GitHub Workflow

## Purpose

This repository uses issues and pull requests as the control plane for human and
agent work. Every non-trivial change should be traceable from issue to PR to
merge.

## Issue Lifecycle

| Status | Meaning |
| --- | --- |
| `status:triage` | newly created; scope not accepted yet |
| `status:ready` | scoped and ready for implementation |
| `status:in-progress` | branch or PR exists |
| `status:review` | PR is ready for review |
| `status:blocked` | cannot proceed without a decision or external resource |
| `status:done` | merged or intentionally closed |

## Labels

Recommended labels:

| Label | Use |
| --- | --- |
| `type:feature` | product or engineering feature |
| `type:bug` | defect or regression |
| `type:task` | bounded implementation, docs, or operations work |
| `type:docs` | documentation-only work |
| `area:github` | GitHub App, webhooks, Octokit, permissions |
| `area:ai` | model calls, schemas, prompts, repair behavior |
| `area:ops` | Cloud Run, Cloud Build, secrets, deployment |
| `area:workflow` | PM workflows such as triage, plan, status, blocker |
| `priority:p0` | outage or data/security issue |
| `priority:p1` | core workflow broken |
| `priority:p2` | important but not urgent |
| `priority:p3` | minor cleanup |

Labels are operational hints, not authorization. Deployment and release approval
still require explicit owner approval.

## Branch Naming

Use issue numbers in branch names when possible:

- `codex/123-short-slug`
- `agy/123-short-slug`
- `docs/123-short-slug`
- `ops/123-short-slug`

Avoid long-lived personal branches.

## PR Lifecycle

1. Open a draft PR early if coordination is useful.
2. Link the issue with `Closes #N` or `Refs #N`.
3. Fill out the PR template.
4. Mark ready for review only after local verification.
5. Merge only after review and after CI passes.
6. Use squash merge by default for work branches.

## Merge Targets

| Source | Target | Purpose |
| --- | --- | --- |
| `codex/*`, `agy/*`, `docs/*`, `ops/*` | `develop` | integrate agent/dev work |
| `develop` | `staging` | deploy staging after review |
| `staging` | `main` | official release after owner approval |

Do not open routine feature PRs directly into `main`.

## Deployment Safety

Only `staging` should trigger Cloud Run deployment. A PR into `staging` is a
deployment decision, not just a code merge.

Pushes to `staging` automatically trigger a read-only GitHub Actions workflow (`Staging Deployment Status`) that performs local verification checks (build, lint, unit tests, and E2E tests) and surfaces direct GCP console links to track the Cloud Build deployment progress. This workflow does NOT execute the deployment itself; the existing Cloud Build trigger remains the sole deployment mechanism.

Do not create extra Cloud Build triggers without updating:

- `cloudbuild.yaml`,
- `docs/operations/ci-cd.md`,
- `docs/operations/release-management.md`.

## Agent Handoff Checklist

Before handing work to an agent, the issue should contain:

- objective,
- controlling docs,
- expected files or modules,
- non-goals,
- acceptance criteria,
- verification commands,
- deployment impact.

If any of these are unclear, the agent should ask before implementation.
