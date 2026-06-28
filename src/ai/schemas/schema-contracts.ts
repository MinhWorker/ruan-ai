/**
 * Workflow-specific JSON schema contracts for AI prompts.
 *
 * Each contract describes the exact output shape the model must produce,
 * including field names, types, enum constraints, and structural rules.
 * These contracts are embedded in prompts so the model knows the target
 * schema before generating output.
 */

/**
 * Returns the JSON schema contract description for a given workflow.
 * Used in both primary workflow prompts and repair prompts.
 */
export function getSchemaContract(workflow: string): string {
  const contract = SCHEMA_CONTRACTS[workflow];
  if (!contract) {
    throw new Error(`No schema contract defined for workflow: ${workflow}`);
  }
  return contract;
}

const SCHEMA_CONTRACTS: Record<string, string> = {
  triage: `Return a JSON object with exactly these fields and no extra fields.
- "workflow": "triage"
- "summary": non-empty string
- "riskLevel": one of "low", "medium", "high"
- "suggestedLabels": array of strings; use [] when no existing label clearly applies
- "missingInformation": array of strings; use [] when nothing is missing
- "recommendedNextCommand": one of "/plan", "human_clarification"
- "commentBody": non-empty markdown string for a public GitHub issue comment
- "confidence": one of "low", "medium", "high"
- "assumptions": array of strings; use [] when none
- "evidence": array of objects with "source" string and "content" string`,

  plan: `Return a JSON object with exactly these fields and no extra fields.
- "workflow": "plan"
- "problemStatement": non-empty string
- "scope": array of strings
- "nonScope": array of strings
- "dependencies": array of strings
- "taskSequence": array of strings in dependency order
- "acceptanceCriteria": array of strings
- "verificationStrategy": non-empty string
- "humanDecisions": array of strings; use [] when no human decision is required
- "commentBody": non-empty markdown string for a public GitHub issue comment
- "confidence": one of "low", "medium", "high"
- "assumptions": array of strings; use [] when none
- "evidence": array of objects with "source" string and "content" string`,

  split: `Return a JSON object with exactly these fields and no extra fields.
- "workflow": "split"
- "tasks": array of task objects. Each task object must include:
  - "id": non-empty unique string
  - "title": non-empty string
  - "objective": non-empty string
  - "filesToInspect": array of strings
  - "allowedOperations": array of strings; each must be one of "create", "edit", "view", "inspect", "read"
  - "dependencies": array of task id strings that reference existing task IDs in this same output
  - "parallelizationGuidance": string
  - "verificationCommands": array of strings
  - "completionEvidence": string
  - "ownerType": one of "human", "coding_agent", "blocked"
- "commentBody": non-empty markdown string for a public GitHub issue comment
- "confidence": one of "low", "medium", "high"
- "assumptions": array of strings; use [] when none
- "evidence": array of objects with "source" string and "content" string`,

  status: `Return a JSON object with exactly these fields and no extra fields.
- "workflow": "status"
- "state": one of "not_started", "ready", "in_progress", "blocked", "needs_review", "done", "paused"
- "completedWork": array of strings; use [] when none is evident
- "openTasks": array of strings; use [] when none is evident
- "blockers": array of strings; use [] when none is evident
- "nextAction": string
- "commentBody": non-empty markdown string for a public GitHub issue comment
- "confidence": one of "low", "medium", "high"
- "assumptions": array of strings; use [] when none
- "evidence": array of objects with "source" string, "content" string, and "type" set to "observed" or "inferred"`,

  blocker: `Return a JSON object with exactly these fields and no extra fields.
- "workflow": "blocker"
- "summary": string
- "likelyCause": string or null
- "nextProvingMethod": string
- "directHumanQuestions": array of strings; use [] when no human question is required
- "commentBody": non-empty markdown string for a public GitHub issue comment
- "confidence": one of "low", "medium", "high"
- "assumptions": array of strings; use [] when none
- "evidence": array of objects with "source" string, "content" string, and "type" set to "observed" or "inferred"`,
};
