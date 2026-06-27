# ADR 0005: No Upstream Vendoring

## Status

Accepted.

## Decision

Upstream `run-gemini-cli` and `gemini-cli` source is cloned into ignored local research directories and not committed into this repository.

## Context

The project needs design lessons from upstream, not a fork or vendored copy. Vendoring would add license, drift, and repository-size concerns.

## Consequences

- Research docs record commit SHAs and local paths.
- Future research refreshes must update `01-upstream-research.md`.
- Implementation must write original code for Ruan AI.

