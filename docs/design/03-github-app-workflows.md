# GitHub App Workflows

## Event Intake

The app subscribes to these MVP events:

- `issues.opened`
- `issues.edited`
- `issues.reopened`
- `issue_comment.created`
- `installation.created`
- `installation.deleted`

PR events are accepted only as context for linked work. PR review automation is roadmap work.

Webhook ingestion must verify the GitHub signature, dedupe by delivery ID, store a minimal job record, and acknowledge quickly. Long-running AI work must run outside the HTTP request path.

## New Issue Triage

Trigger: `issues.opened` or `/triage`.

Inputs:

- issue title/body,
- author association,
- current labels,
- parsed issue-template fields when the issue body uses markdown template
  headings,
- linked PRs/issues if cheaply available,
- repository metadata and configured PM rules.

Output:

- issue summary,
- suggested labels from the repository's existing label set,
- missing information,
- risk level,
- recommended next command, usually `/plan` or a human clarification.

The app must not create new labels in MVP. It may apply only labels that already exist and match configured allowlists.
When template fields are missing or contain placeholder answers such as
`_No response_`, triage asks actionable clarification questions and recommends
human clarification instead of advancing to planning.

## Planning

Trigger: `/plan`.

Inputs:

- issue content,
- prior app comments for this issue,
- recent maintainer comments,
- bounded repository context if configured,
- product rules from repository config.

Output:

- problem statement,
- scope and non-scope,
- dependencies,
- proposed task sequence,
- acceptance criteria,
- verification strategy,
- human decisions required before implementation.

If the issue is underspecified, the app asks a direct question and does not produce a fake plan.
When the issue is ready, the plan must be implementation-ready for coding
agents: concrete task order, observable acceptance criteria, verification
commands when available, explicit non-scope, and cited evidence.

## Task Splitting

Trigger: `/split` or successful `/plan`.

Output:

- dependency-ordered task list,
- task owner type: human, coding agent, or blocked,
- files or areas to inspect,
- allowed operations,
- verification command expectations,
- completion evidence required.

Tasks must be suitable for independent coding agents. If two tasks can run in parallel, the output must say so explicitly. If they share files or state, the output must serialize them.
Allowed operations are limited to the policy allowlist: `create`, `edit`,
`view`, `inspect`, and `read`.

## Status Refresh

Trigger: `/status` or scheduled follow-up.

Inputs:

- issue comments after the active plan,
- checklist state,
- app labels,
- optional project item fields.

Output:

- current state: not started, ready, in progress, blocked, needs review, done, paused,
- completed work,
- open tasks,
- blockers,
- next action.

The app must distinguish observed evidence from inference.

## Blocker Handling

Trigger: `/blocker` or comments containing blocker language in an app-managed issue.

Output:

- blocker summary,
- likely cause only when supported by evidence,
- next proving method,
- direct question for the human if a decision is required.

The app must not resolve a blocker by inventing requirements or telling a coding agent to proceed without authority.

## Stop/Pause

Trigger: `/stop`.

Behavior:

- add a paused marker comment,
- remove or update app-managed active labels,
- stop scheduled follow-ups for the issue,
- keep historical comments intact.
