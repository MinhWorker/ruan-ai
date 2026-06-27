# Upstream Research

## Research Inputs

| Repository | Purpose | Pinned commit | Local path |
| --- | --- | --- | --- |
| `google-github-actions/run-gemini-cli` | GitHub Action wrapper around Gemini CLI, including workflow examples for dispatch, issue triage, PR review, and assistant usage. | `055c24c9f565debe282e4adf1f7ca1715040ebe2` | `.research/upstream/run-gemini-cli` |
| `google-gemini/gemini-cli` | Core Gemini CLI implementation, package layout, tool boundaries, safety/policy systems, evals, and JSON output behavior. | `ae0a3aa7b928cc73bb09604bb9c2c020e6b647db` | `.research/upstream/gemini-cli` |

The clones are intentionally excluded from git. Re-run `git -C <path> rev-parse HEAD` to audit the exact source used by this document.

## Findings From `run-gemini-cli`

`run-gemini-cli` is a composite GitHub Action. It validates auth inputs, writes optional `.gemini/settings.json`, installs Gemini CLI, runs `gemini --yolo --prompt ... --output-format json`, stores stdout/stderr as artifacts, and exposes the parsed response as a GitHub Action output.

Patterns to adapt:

- Dispatch is explicit. The sample dispatcher maps GitHub events and `@gemini-cli` commands to bounded workflows instead of letting the model choose arbitrary work.
- Permission tiers are separate. Triage runs without GitHub auth tokens passed into Gemini, while plan execution gets broader write permissions only after a command path selects it.
- Outputs are structured. The action expects JSON output, validates it with `jq`, and stores raw logs for diagnostics.
- Prompt context is serialized before model invocation. Workflows write `.gemini/context.json` from GitHub event fields and repository metadata.
- User acknowledgement is immediate. The dispatcher posts a comment that work has started and links to logs.
- Labels are validated against repository labels before being applied. This guards against prompt injection producing arbitrary label names.

Patterns not to copy directly:

- The GitHub Action is event-runner centric. Ruan AI needs a long-lived service that can dedupe webhooks, resume jobs, and coordinate progress across comments.
- `--yolo` is not acceptable as the service default. Ruan AI should grant narrow tool capabilities by workflow step, not blanket execution.
- The sample assistant and plan-execute workflows allow code-writing operations. Ruan AI MVP is PM orchestration; coding-agent execution stays outside this service until explicitly designed.

## Findings From `gemini-cli`

`gemini-cli` is a TypeScript monorepo. The root package exposes a `gemini` binary and workspaces for `cli`, `core`, `sdk`, `a2a-server`, `devtools`, `test-utils`, and IDE companion packages.

Useful architecture concepts:

- Core boundaries are separated into areas such as `agents`, `commands`, `config`, `context`, `hooks`, `mcp`, `output`, `policy`, `prompts`, `resources`, `routing`, `safety`, `scheduler`, `skills`, `telemetry`, and `tools`.
- The repo has evals for subagents, plan mode, shell safety, prompt injection, JSON output, context fidelity, and automated tool use. Ruan AI should copy the discipline, not the code.
- The CLI treats tool use, context construction, policy, telemetry, and output formatting as first-class subsystems. Ruan AI should keep the same separations in NestJS modules.
- JSON output exists in Gemini CLI and is a strong precedent for machine-readable contracts. Ruan AI should require structured AI outputs for all workflow decisions.

Concepts to adapt:

- Tool registry idea: expose GitHub operations as explicit service capabilities with typed input/output, not raw shell commands.
- Policy layer: evaluate each requested action before any write to GitHub.
- Context layer: assemble concise issue/repo/project context with a clear budget and provenance.
- Scheduler/job layer: isolate webhook ingestion from longer AI workflows.
- Telemetry layer: record model calls, token/rate-limit behavior, job states, and failed output validation.

Concepts not in MVP:

- Browser automation, IDE companion, A2A server, arbitrary MCP tool hosting, and code-editing agents.
- Full Gemini CLI compatibility. Ruan AI is a project-management app using Gemini/Gemma models, not a CLI wrapper.

## Current Local Project State

The application is a generated NestJS project with default `AppModule`, `AppController`, `AppService`, Jest unit/e2e scaffolding, and no business modules. This means the implementation can introduce module boundaries cleanly without preserving existing product behavior.

## Research Updates

Refresh this file when either upstream commit changes or the MVP scope changes. Each refresh must record:

- upstream commit SHA,
- files or areas inspected,
- design conclusions changed,
- conclusions confirmed unchanged.

