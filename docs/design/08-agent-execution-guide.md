# Agent Execution Guide

This project is intended to be implemented by multiple coding agents. Agents must treat `docs/design` as the controlling specification.

## Before Starting A Task

1. Read `00-index.md`.
2. Read the subsystem doc that controls the task.
3. Check ADRs under `decisions/`.
4. Read `AGENTS.md` and `docs/operations/release-management.md` before touching deployment, CI/CD, branches, or releases.
5. Inspect current code before editing.
6. Keep changes inside the task boundary.

## Task Handoff Format

Each implementation task should include:

- objective,
- controlling docs,
- files or modules expected to change,
- non-goals,
- acceptance criteria,
- verification commands,
- expected GitHub behavior if applicable.

## Implementation Rules

- Prefer NestJS modules matching `04-system-architecture.md`.
- Keep GitHub writes behind policy validation.
- Keep model responses behind schema validation.
- Do not add code-editing agent behavior in MVP.
- Do not introduce PR review as a primary workflow in MVP.
- Do not add a database-heavy domain model before job/idempotency needs require it.
- Do not hard-code model IDs without validation and fallback behavior.
- Do not deploy, change Cloud Run configuration, or create release tags unless the task explicitly authorizes it.

## Verification Rules

For each task, run the narrowest meaningful verification:

- unit tests for pure workflow/context/policy logic,
- e2e tests for webhook-to-comment behavior,
- lint/build checks before handoff,
- fixture-based tests for prompt/output schema validation.

Agents must report unverified assumptions explicitly.

## Documentation Updates

If implementation discovers a design conflict, update the relevant doc or ADR in the same pull request. Do not silently implement behavior that contradicts this design set.

## Third-Party AI Delegation

Do not rely on Antigravity or Gemini Subagents for required implementation work in this project until a future ADR approves it. Local testing on this machine found both paths too unreliable or slow for the current phase.
