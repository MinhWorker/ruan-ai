# ADR 0006: No Third-Party Agent Dependency For MVP

## Status

Accepted.

## Decision

The MVP implementation will not depend on Antigravity headless mode or the local Gemini Subagents plugin.

## Context

Local testing showed Antigravity `agy --print` is not reliable as a non-TTY subprocess on Windows. The local Gemini Subagents plugin loaded, but a six-file repo inventory timed out at 90 seconds and a one-file second-opinion run took about 39 seconds.

## Consequences

- Codex remains the implementation driver for this phase.
- Third-party agent delegation can be revisited only after a future ADR documents stable latency, output, and failure behavior.
- Documentation and code must not assume those tools are available.

