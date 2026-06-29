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

## GitHub Actions Deployment Status Visibility Layer

To provide feedback in the GitHub UI, a lightweight GitHub Actions workflow runs on pushes to the `staging` branch (defined in [.github/workflows/staging-deployment.yml](file:///D:/ai/ruan-ai/.github/workflows/staging-deployment.yml)).

This workflow does **not** perform the deployment, preventing duplicate deployment attempts. Instead, it:
1. Performs local checks (build, lint, unit tests, and E2E tests) to catch regression errors early.
2. Surfaces links to Google Cloud Console (Cloud Build and Cloud Run) directly in the GitHub Job Summary.

### Where to Monitor Staging Deployment Progress

- **GitHub UI**: Check the run summary of the **Staging Deployment Status** workflow under the Actions tab or commit checks.
- **GCP Cloud Build**: [GCP Cloud Build History](https://console.cloud.google.com/cloud-build/builds?project=gen-lang-client-0591588109) or search by commit SHA `https://console.cloud.google.com/cloud-build/builds?project=gen-lang-client-0591588109&query=commit_sha%3D%22<COMMIT_SHA>%22`
- **GCP Cloud Run Revisions**: [GCP Cloud Run Service Revisions](https://console.cloud.google.com/run/detail/us-central1/ruan-ai-staging/revisions?project=gen-lang-client-0591588109)
- **GCP Cloud Run Logs**: [GCP Cloud Run Service Logs](https://console.cloud.google.com/run/detail/us-central1/ruan-ai-staging/logs?project=gen-lang-client-0591588109)
- **Live Health Endpoint**: [ruan-ai-staging Health](https://ruan-ai-staging-309117600688.us-central1.run.app/health)

### Optional Upgrade: Direct Status Querying via Workload Identity Federation

Currently, the workflow only prints static monitoring links. To make the GitHub Action block or report a dynamic deployment status check by querying GCP Cloud Build directly, future maintainers can configure GCP authentication using Workload Identity Federation (WIF).

#### Required GCP Infrastructure Setup:
1. **Workload Identity Pool & Provider**: Create a Workload Identity Pool and connect it to GitHub.
2. **Service Account**: Create a dedicated GCP Service Account (e.g., `github-actions-observer@gen-lang-client-0591588109.iam.gserviceaccount.com`).
3. **IAM Permissions**: Grant the Service Account the **Cloud Build Viewer** (`roles/cloudbuild.builds.viewer`) role on the project to read build statuses.
4. **Workload Identity User**: Grant the GitHub repository permission to impersonate the Service Account.

#### Required GitHub Repository Settings:
Add the following secrets or variables to the GitHub repository:
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: The full resource name of the Workload Identity Provider (e.g., `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL_ID>/providers/<PROVIDER_ID>`).
- `GCP_SERVICE_ACCOUNT`: The email of the dedicated GCP Service Account.
- `GCP_PROJECT_ID`: `gen-lang-client-0591588109`

#### Implementation Steps for Workflow Upgrade:
1. Add `permissions: id-token: write` and `contents: read` to the workflow job.
2. Add the GCP authentication step:
   ```yaml
   - name: Authenticate to Google Cloud
     uses: google-github-actions/auth@v2
     with:
       workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
       service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
   ```
3. Set up the Google Cloud SDK:
   ```yaml
   - name: Set up Cloud SDK
     uses: google-github-actions/setup-gcloud@v2
   ```
4. Query Cloud Build status (poll until finished or timed out):
   ```yaml
   - name: Wait for Cloud Build to Complete
     run: |
       # Poll Cloud Build for this commit SHA
       for i in {1..30}; do
         STATUS=$(gcloud builds list --project=gen-lang-client-0591588109 --filter="results.images.tags='latest' AND source.provenance.resolvedRepoSource.commitSha='${{ github.sha }}'" --format="value(status)" --limit=1)
         echo "Current Build Status: $STATUS"
         if [ "$STATUS" = "SUCCESS" ]; then
           exit 0
         elif [ "$STATUS" = "FAILURE" ] || [ "$STATUS" = "INTERNAL_ERROR" ] || [ "$STATUS" = "TIMEOUT" ] || [ "$STATUS" = "CANCELLED" ]; then
           echo "Cloud Build failed with status: $STATUS"
           exit 1
         fi
         sleep 15
       done
       echo "Timed out waiting for Cloud Build"
       exit 1
   ```

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
2. Open PRs linked to issues.
3. Merge reviewed work into `develop`.
4. Promote `develop` to `staging` when ready for live pilot.
5. Promote `staging` to `main` for official releases.

For this early project, it is acceptable to temporarily connect Cloud Build to `codex/milestone-1-checkpoint`, but switch to `staging` before letting multiple agents work concurrently.

The release and deployment rules are defined in `docs/operations/release-management.md`.
The issue and PR rules are defined in `docs/operations/github-workflow.md`.

## Versioning

Use tags for official releases:

- `v0.1.0` for first usable pilot,
- `v0.2.0` for next feature release,
- patch tags such as `v0.1.1` for fixes.

Keep Cloud Run revision names as deployment history, but treat Git tags as the official application version history.
