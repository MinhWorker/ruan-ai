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
  triage: `Your output MUST be a JSON object with exactly these fields (no extra fields allowed):
{
  "workflow": "triage",                       // REQUIRED: must be the literal string "triage"
  "summary": "<string>",                      // REQUIRED: non-empty summary of the triage analysis
  "riskLevel": "low" | "medium" | "high",     // REQUIRED: one of these three values
  "suggestedLabels": ["<string>", ...],       // REQUIRED: array of strings (can be empty)
  "missingInformation": ["<string>", ...],    // REQUIRED: array of strings (can be empty)
  "recommendedNextCommand": "/plan" | "human_clarification",  // REQUIRED: one of these two values
  "commentBody": "<string>",                  // REQUIRED: non-empty markdown comment body
  "confidence": "low" | "medium" | "high",    // REQUIRED: one of these three values
  "assumptions": ["<string>", ...],           // REQUIRED: array of strings (can be empty)
  "evidence": [                               // REQUIRED: array of evidence objects (can be empty)
    { "source": "<string>", "content": "<string>" }
  ]
}`,

  plan: `Your output MUST be a JSON object with exactly these fields (no extra fields allowed):
{
  "workflow": "plan",                         // REQUIRED: must be the literal string "plan"
  "problemStatement": "<string>",             // REQUIRED: non-empty problem description
  "scope": ["<string>", ...],                // REQUIRED: array of strings
  "nonScope": ["<string>", ...],             // REQUIRED: array of strings
  "dependencies": ["<string>", ...],         // REQUIRED: array of strings
  "taskSequence": ["<string>", ...],         // REQUIRED: array of strings
  "acceptanceCriteria": ["<string>", ...],   // REQUIRED: array of strings
  "verificationStrategy": "<string>",         // REQUIRED: non-empty string
  "humanDecisions": ["<string>", ...],       // REQUIRED: array of strings
  "commentBody": "<string>",                  // REQUIRED: non-empty markdown comment body
  "confidence": "low" | "medium" | "high",    // REQUIRED: one of these three values
  "assumptions": ["<string>", ...],           // REQUIRED: array of strings (can be empty)
  "evidence": [                               // REQUIRED: array of evidence objects (can be empty)
    { "source": "<string>", "content": "<string>" }
  ]
}`,

  split: `Your output MUST be a JSON object with exactly these fields (no extra fields allowed):
{
  "workflow": "split",                        // REQUIRED: must be the literal string "split"
  "tasks": [                                  // REQUIRED: array of task objects
    {
      "id": "<string>",                       // REQUIRED: non-empty unique task ID
      "title": "<string>",                    // REQUIRED: non-empty task title
      "objective": "<string>",                // REQUIRED: non-empty objective
      "filesToInspect": ["<string>", ...],   // REQUIRED: array of file paths
      "allowedOperations": ["<string>", ...], // REQUIRED: array of allowed ops
      "dependencies": ["<string>", ...],     // REQUIRED: array of task IDs this depends on (must reference IDs in this list)
      "parallelizationGuidance": "<string>",  // REQUIRED: guidance string
      "verificationCommands": ["<string>", ...], // REQUIRED: array of commands
      "completionEvidence": "<string>",       // REQUIRED: evidence string
      "ownerType": "human" | "coding_agent" | "blocked"  // REQUIRED: one of these three values
    }
  ],
  "commentBody": "<string>",                  // REQUIRED: non-empty markdown comment body
  "confidence": "low" | "medium" | "high",    // REQUIRED: one of these three values
  "assumptions": ["<string>", ...],           // REQUIRED: array of strings (can be empty)
  "evidence": [                               // REQUIRED: array of evidence objects (can be empty)
    { "source": "<string>", "content": "<string>" }
  ]
}`,

  status: `Your output MUST be a JSON object with exactly these fields (no extra fields allowed):
{
  "workflow": "status",                       // REQUIRED: must be the literal string "status"
  "state": "not_started" | "ready" | "in_progress" | "blocked" | "needs_review" | "done" | "paused",  // REQUIRED
  "completedWork": ["<string>", ...],        // REQUIRED: array of strings (can be empty)
  "openTasks": ["<string>", ...],            // REQUIRED: array of strings (can be empty)
  "blockers": ["<string>", ...],             // REQUIRED: array of strings (can be empty)
  "nextAction": "<string>",                   // REQUIRED: string describing next action
  "commentBody": "<string>",                  // REQUIRED: non-empty markdown comment body
  "confidence": "low" | "medium" | "high",    // REQUIRED: one of these three values
  "assumptions": ["<string>", ...],           // REQUIRED: array of strings (can be empty)
  "evidence": [                               // REQUIRED: array of evidence objects (can be empty)
    { "source": "<string>", "content": "<string>", "type": "observed" | "inferred" }
  ]
}`,

  blocker: `Your output MUST be a JSON object with exactly these fields (no extra fields allowed):
{
  "workflow": "blocker",                      // REQUIRED: must be the literal string "blocker"
  "summary": "<string>",                      // REQUIRED: non-empty blocker summary
  "likelyCause": "<string>" | null,           // OPTIONAL: string or null
  "nextProvingMethod": "<string>",            // REQUIRED: string describing next proving method
  "directHumanQuestions": ["<string>", ...], // REQUIRED: array of strings
  "commentBody": "<string>",                  // REQUIRED: non-empty markdown comment body
  "confidence": "low" | "medium" | "high",    // REQUIRED: one of these three values
  "assumptions": ["<string>", ...],           // REQUIRED: array of strings (can be empty)
  "evidence": [                               // REQUIRED: array of evidence objects (can be empty)
    { "source": "<string>", "content": "<string>", "type": "observed" | "inferred" }
  ]
}`,
};
