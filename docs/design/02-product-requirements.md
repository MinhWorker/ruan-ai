# Product Requirements

## Goal

Ruan AI is an AI Project Manager GitHub App. It turns GitHub issues and project signals into clear plans, task breakdowns, progress summaries, blocker escalations, and coding-agent handoff instructions.

The MVP does not write product code. It manages work so coding agents and humans stay aligned.

## Primary Users

- Project owner: defines scope, reviews progress, and resolves ambiguity.
- Coding agent: consumes plans and task comments produced by Ruan AI.
- Repository maintainer: needs GitHub state to remain readable, auditable, and reversible.

## MVP Capabilities

- Intake a new issue or issue comment from GitHub App webhooks.
- Determine whether the issue needs triage, planning, status refresh, blocker handling, or human escalation.
- Summarize the issue into problem statement, desired outcome, constraints, missing inputs, and proposed next action.
- Split accepted work into implementation-ready tasks with dependencies and acceptance criteria.
- Maintain progress in GitHub comments, labels, and optional project fields.
- Detect blockers or ambiguity and ask a human a direct question instead of inventing requirements.
- Produce coding-agent handoff comments that include scope, files to inspect, expected outputs, verification commands, and explicit non-goals.

## MVP Non-Goals

- Direct code edits, branch creation, commits, pushes, pull requests, or merges.
- Autonomous PR review as a primary workflow.
- Release notes, dashboards, billing UI, or multi-repository portfolio management.
- Running arbitrary shell commands from model output.
- Replacing GitHub Issues or Projects as the visible source of truth.

## Success Criteria

- A maintainer can install the app on a repository and see useful PM comments on new issues.
- Every AI-generated plan has a clear task boundary, acceptance criteria, and dependency ordering.
- Every write to GitHub is traceable to a webhook event, command, or scheduled job.
- The app refuses unsafe or ambiguous work with a clear escalation question.
- Free-tier model limits are respected through rate limiting, context budgeting, retry policy, and fallback summaries.

## Commands

Commands are written as issue comments addressed to the app. The exact mention can be configured, but the command verbs are stable.

| Command | Scope |
| --- | --- |
| `/triage` | Re-analyze issue scope, labels, missing data, and next action. |
| `/plan` | Produce or refresh an implementation plan. |
| `/split` | Break a plan into dependency-ordered coding-agent tasks. |
| `/status` | Summarize progress from issue comments, checklist state, and labels. |
| `/blocker` | Analyze a blocker report and ask for the next human decision. |
| `/handoff` | Produce a coding-agent-ready handoff for the next task. |
| `/stop` | Mark app-managed work paused and stop scheduled follow-ups for the issue. |

## Output Standards

Every public comment from the app must be concise and structured:

- state what was analyzed,
- state the decision or plan,
- list action items only when they are actionable,
- include blockers or assumptions,
- avoid speculative implementation details when the issue lacks enough information.

