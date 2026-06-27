# ADR 0001: GitHub App Service First

## Status

Accepted.

## Decision

Ruan AI will be built first as a hosted NestJS GitHub App service. A GitHub Action companion is deferred.

## Context

`run-gemini-cli` demonstrates useful GitHub Action workflows, but those workflows are short-lived runner jobs. Ruan AI needs durable dedupe, job retry, scheduled follow-ups, app-level state, and PM continuity across comments.

## Consequences

- Webhook ingestion, GitHub App auth, and job processing are first-class service modules.
- GitHub Actions remain a source of workflow inspiration, not the primary runtime.
- Future GitHub Action support must integrate with the service rather than replace it.

