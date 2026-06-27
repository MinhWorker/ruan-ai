# ADR 0002: Issue PM Workflow First

## Status

Accepted.

## Decision

MVP focuses on GitHub issue and project-management workflows: triage, planning, task splitting, status, blocker handling, and handoff.

## Context

The project exists to act as an AI Project Manager. PR review is useful but would shift the first implementation toward code review instead of PM orchestration.

## Consequences

- PR review is roadmap work.
- PR events can be read only as context for linked issues.
- MVP tests should validate issue workflows first.

