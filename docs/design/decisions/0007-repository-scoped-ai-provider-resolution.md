# 7. Repository-Scoped AI Provider Resolution

Date: 2026-06-30

## Status

Accepted

## Context

Ruan AI is expanding from a single-tenant, app-level configuration (using a single `GOOGLE_AI_STUDIO_API_KEY`) to a multi-repository, multi-installation GitHub App. Different repositories and organizations need to use their own AI provider configurations, including Google AI Studio and Google Cloud's Gemini Enterprise Agent Platform API (formerly Vertex AI), to manage billing, quotas, and data residency boundaries.

We need a design for how AI provider configuration is scoped, resolved, stored, and safely executed without leaking secrets or falling back to incorrect billing accounts. This design addresses issue #44 and sets the baseline for implementation issues #15 and #45.

## Decisions

### 1. Scope and Inheritance

- Provider configuration is scoped by **Installation ID** with optional overrides by **Repository ID**.
- The effective lookup key is a combination of `installationId` and `repositoryId`.
- **Inheritance**: The app resolves configuration in this order:
  1. Repository-level config.
  2. Installation-level config.
  3. App-level config (supported only during the migration transition, acting as a global fallback).

### 2. Provider Precedence

- The supported provider families are **Google AI Studio** and **Google Cloud Gemini Enterprise Agent Platform API** (formerly Vertex AI).
- If both AI Studio and the Google Cloud Agent Platform API are configured for the same repository/installation, **Google AI Studio** is the default selected provider.
- A repository can explicitly override this default by setting `preferredProvider: 'google-cloud-agent-platform'`.
- If the selected provider is unavailable, rate-limited, or invalid, the job must **fail fast**. The system must **never silently fallback** to the other provider or the app-level fallback (once migration is complete), as this violates billing and data trust boundaries.
- Model fallback remains allowed only inside the already resolved provider and credential boundary. For example, an AI Studio primary model may fallback to an AI Studio fallback model configured for the same repository, but it must not silently move to the Google Cloud Agent Platform API.

### 3. Secret Handling

- **Storage**: Real secrets are never stored in the application database. The database stores references to an external secret store (e.g., Google Cloud Secret Manager).
- **AI Studio**: Represented by a Secret Manager reference (e.g., `projects/.../secrets/.../versions/latest`) resolving to an API key.
- **Google Cloud Agent Platform API**: Prefer Workload Identity Federation or service account impersonation. Static service account JSON keys are a legacy last resort, require explicit owner approval, and must only be referenced through Secret Manager. The Google Cloud Agent Platform API requires an identity-based auth model, not just an API key.
- **Rules**: Secrets must never be accepted through GitHub issues, comments, or committed `.ruan-ai.yml` repository files. They are encrypted, rotated, and audited externally by the secret store. Logs and telemetry must not include resolved secret values, full secret resource payloads, or raw credential material.

### 4. Google Cloud Agent Platform API Specifics

- Google Cloud Agent Platform API configuration requires specific non-secret fields: `project`, `location` (e.g., `us-central1`), and model profiles/IDs.
- The Google Cloud Agent Platform API is the current Google Cloud positioning for what was previously documented as Vertex AI. Future implementation must verify the current official SDK/API surface at implementation time, including whether the unified Gen AI SDK still uses `vertexai: true` as the client option.
- This provider is fundamentally different from AI Studio's API-key auth and must be treated as a distinct provider integration path.

### 5. Runtime Integration

- An `AiProviderResolver` (or `ProviderConfigRepository`) boundary will be introduced in the NestJS architecture.
- Resolution happens early in the job execution before the `AiClient` is instantiated.
- The resolver fetches the config, retrieves secrets from the secret store, and passes them to a factory that instantiates the correct client (`RealAiClient` for AI Studio or a new Google Cloud Agent Platform client).
- Model availability checks are performed against the explicitly resolved provider.

### 6. Persistence Relationship

- Provider configuration mappings (mapping `repositoryId`/`installationId` to config references) require **durable storage** (e.g., a `ProviderConfig` database table).
- This storage is strictly separated from persistent job storage (issue #4) and durable workflow state (issue #23).
- Separation is required because provider config governs _identity and billing_, while job/workflow state governs _progress and event history_.

### 7. Failure and Telemetry

- **Safe Behavior**: Missing or invalid provider config safely halts the job.
- **Telemetry Categories**: `provider_resolution_failure`, `provider_auth_failure`, `provider_rate_limit`, `provider_model_unavailable`.
- **User-Visible Errors**: For explicit command workflows where a human is waiting, the app may post a safe, generic comment: _"AI provider configuration is missing or invalid. Please contact the repository administrator."_ Background event workflows should record telemetry and avoid noisy comments unless a future policy explicitly allows them.
- **Prohibitions**: Logs and telemetry must never contain provider secrets, raw keys, service account JSON, or full unredacted prompts.

### 8. Migration

- The current app-level `GOOGLE_AI_STUDIO_API_KEY` environment variable remains supported during the transition phase.
- It acts as the fallback for all repositories without specific provider configuration.
- To fully migrate, administrators must populate the durable `ProviderConfig` storage and verify Secret Manager bindings for all active installations before the app-level fallback is formally disabled.

## Consequences

- Future agents have a clear algorithm for resolving AI providers and enforcing AI Studio defaults.
- Google Cloud Agent Platform API requires separate auth abstractions compared to AI Studio.
- A database table for `ProviderConfig` is now required for multi-repo deployments.
- Follow-up issues (#15 multi-repo config, #45 Google Cloud Agent Platform API) can proceed without ambiguity.
