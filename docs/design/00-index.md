# Ruan AI Design Index

Ruan AI is a NestJS GitHub App service for AI-assisted project management. The first milestone is a documentation baseline that future coding agents can treat as the source of truth before implementing product code.

## Current Decisions

- Product shape: hosted GitHub App service, not GitHub Action first.
- MVP workflow: issue and project-management workflow first.
- State model: GitHub-first state, with minimal service-side job state.
- Canonical docs language: English.
- Upstream research: local pinned clones under `.research/upstream`, excluded from git.
- Third-party delegation: do not depend on Antigravity or Gemini Subagents for this phase. Both were tested and are not reliable enough for plan execution in this workspace.

## Reading Order

1. `01-upstream-research.md` - what was learned from `run-gemini-cli` and `gemini-cli`.
2. `02-product-requirements.md` - MVP goals, non-goals, personas, and success criteria.
3. `03-github-app-workflows.md` - event handling and user-visible PM workflows.
4. `04-system-architecture.md` - NestJS module boundaries and data flow.
5. `05-ai-orchestration.md` - AI prompt contracts, model routing, and context rules.
6. `06-state-and-storage.md` - GitHub-first persistence and minimal internal state.
7. `07-security-and-permissions.md` - permissions, trust boundaries, and audit rules.
8. `08-agent-execution-guide.md` - instructions for coding agents implementing this project.
9. `09-roadmap-and-backlog.md` - implementation milestones and deferred work.

## Traceability

| MVP requirement | Controlling docs |
| --- | --- |
| Receive GitHub events as a GitHub App | `03-github-app-workflows.md`, `04-system-architecture.md`, `07-security-and-permissions.md` |
| Triage new issues | `02-product-requirements.md`, `03-github-app-workflows.md`, `05-ai-orchestration.md` |
| Produce implementation plans for coding agents | `03-github-app-workflows.md`, `05-ai-orchestration.md`, `08-agent-execution-guide.md` |
| Track progress and blockers in GitHub | `03-github-app-workflows.md`, `06-state-and-storage.md` |
| Escalate ambiguous or unsafe work to humans | `02-product-requirements.md`, `05-ai-orchestration.md`, `07-security-and-permissions.md` |
| Stay within free-tier model/rate constraints | `05-ai-orchestration.md`, `09-roadmap-and-backlog.md` |
| Avoid scope drift during agent implementation | `08-agent-execution-guide.md`, `09-roadmap-and-backlog.md` |

## ADRs

The `decisions/` folder records durable architecture decisions. An ADR overrides roadmap ideas when they conflict.

