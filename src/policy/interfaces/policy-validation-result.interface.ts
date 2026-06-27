/**
 * Result of policy validation for a triage write.
 */
export interface PolicyValidationResult {
  /** Whether the overall validation passed (at least some writes are allowed). */
  valid: boolean;

  /** Labels that passed policy and can be applied. */
  allowedLabels: string[];

  /** Labels that were rejected with reasons. */
  rejectedLabels: Array<{ label: string; reason: string }>;

  /** Whether the comment passed policy and can be written. */
  commentAllowed: boolean;

  /** Reason for comment rejection, if applicable. */
  commentRejectionReason?: string;

  /** Non-blocking warnings about the triage output. */
  warnings: string[];
}
