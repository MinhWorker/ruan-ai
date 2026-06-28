## Summary

- 

## Linked Issue

Closes #

## Scope

- 

## Non-Goals

- 

## Verification

- [ ] `$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build`
- [ ] `$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings=0`
- [ ] `$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand`
- [ ] `$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e`

If any check was skipped, explain why:

- 

## Deployment Impact

- [ ] No deployment impact.
- [ ] Changes Cloud Build / Cloud Run / env vars / secrets / IAM. Owner approval required.
- [ ] Requires promotion to `staging` to deploy.
- [ ] Requires release promotion to `main`. Owner approval required.

## Live Write Tests

- [ ] Not applicable.
- [ ] Required but not run. Owner approval required.
- [ ] Run against disposable issue:

## Reviewer Notes

- 
