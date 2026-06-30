# GitHub Workflow

## Purpose

This repository uses issues and pull requests as the control plane for human and
agent work. Every non-trivial change should be traceable from issue to PR to
merge.

## Issue Lifecycle

| Status               | Meaning                                                |
| -------------------- | ------------------------------------------------------ |
| `status:triage`      | newly created; scope not accepted yet                  |
| `status:ready`       | scoped and ready for implementation                    |
| `status:in-progress` | branch or PR exists                                    |
| `status:review`      | PR is ready for review                                 |
| `status:blocked`     | cannot proceed without a decision or external resource |
| `status:done`        | merged or intentionally closed                         |

## Labels

Recommended labels:

| Label           | Use                                                |
| --------------- | -------------------------------------------------- |
| `type:feature`  | product or engineering feature                     |
| `type:bug`      | defect or regression                               |
| `type:task`     | bounded implementation, docs, or operations work   |
| `type:docs`     | documentation-only work                            |
| `area:github`   | GitHub App, webhooks, Octokit, permissions         |
| `area:ai`       | model calls, schemas, prompts, repair behavior     |
| `area:ops`      | Cloud Run, Cloud Build, secrets, deployment        |
| `area:workflow` | PM workflows such as triage, plan, status, blocker |
| `priority:p0`   | outage or data/security issue                      |
| `priority:p1`   | core workflow broken                               |
| `priority:p2`   | important but not urgent                           |
| `priority:p3`   | minor cleanup                                      |

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

| Source                                | Target    | Purpose                               |
| ------------------------------------- | --------- | ------------------------------------- |
| `codex/*`, `agy/*`, `docs/*`, `ops/*` | `develop` | integrate agent/dev work              |
| `develop`                             | `staging` | deploy staging after review           |
| `staging`                             | `main`    | official release after owner approval |

**Merge Policy:**

- **Work branches -> `develop`**: Requires a PR with local/CI validation expectations met. Squash merge by default.
- **`develop` -> `staging`**: Requires a PR. Merging into `staging` is a deployment decision.
- **`staging` -> `main`**: Requires a PR. Owner approval is mandatory.
- **No direct pushes to `main`**.
- **No release tags without owner approval**.

## Branch Protection and Rulesets

To enforce the workflow safely, the repository owner must manually configure the following branch protection rules or rulesets (Settings > Rules > Rulesets).

Current observed settings as of 2026-06-30:

- Repository rulesets: none.
- `main` branch protection: not configured.
- `staging` branch protection: not configured.
- `develop` branch protection: not configured.

Until these settings are applied, the workflow is enforced by docs, PR review, and owner discipline only.

### `develop`

- **Require pull request before merging**
- **Require status checks to pass before merging only after matching checks exist in GitHub.**
  - Current baseline: local verification evidence in the PR template remains required until a dedicated `develop` CI workflow exists.
  - Future recommended required checks:
    - build validation,
    - lint,
    - unit tests,
    - e2e tests.
  - Do not configure required checks by expected names before GitHub has observed those checks at least once; otherwise routine merges can become blocked.
- **Do not allow direct pushes.**

### `staging`

- **Require pull request before merging**
- **Require status checks to pass before merging:**
  - Status checks should include `Staging Deployment Status` after GitHub has observed it on the `staging` branch.
  - Cloud Build remains authoritative for final deploy success; the GitHub Actions check is a visibility and local-validation layer unless a future Workload Identity Federation upgrade changes this.
- **Do not allow direct pushes.**

### `main`

- **Require pull request before merging**
- **Require approvals:** 1 (Must be from a repository owner or designated release manager).
- **Do not allow direct pushes.**

### Tags

- Restrict tag creation to owners/admins to prevent unauthorized release tags (e.g., `v0.1.0`).

## Deployment Safety

Only `staging` should trigger Cloud Run deployment. A PR into `staging` is a
deployment decision, not just a code merge.

Pushes to `staging` automatically trigger a read-only GitHub Actions workflow (`Staging Deployment Status`) that performs local verification checks (build, lint, unit tests, and E2E tests) and surfaces direct GCP console links to track the Cloud Build deployment progress. This workflow does not execute the deployment itself; the existing Cloud Build trigger remains the sole deployment mechanism. Until a future Workload Identity Federation upgrade is implemented, the GitHub Actions result reflects local validation only; Cloud Build remains authoritative for the final deploy result.

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
