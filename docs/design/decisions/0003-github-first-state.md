# ADR 0003: GitHub-First State

## Status

Accepted.

## Decision

GitHub issues, comments, labels, and optional project fields are the visible source of truth. Internal storage is limited to operational state.

## Context

Maintainers and coding agents already work in GitHub. Duplicating product state into an app database would increase drift and review burden.

## Consequences

- App comments need stable markers for idempotent updates.
- The service stores delivery/job/comment IDs, retries, schedules, audit metadata, and rate-limit counters.
- Product state should be recoverable from GitHub where practical.

