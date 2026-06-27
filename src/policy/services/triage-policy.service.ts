import { Injectable, Logger } from '@nestjs/common';
import { TriageOutput } from '../../ai/interfaces/triage-output.interface';
import { PolicyValidationResult } from '../interfaces/policy-validation-result.interface';

/**
 * Validates proposed triage writes against policy rules.
 *
 * Policy rules:
 * 1. Only labels that exist in the repository label set may be applied.
 * 2. If a label allowlist is configured, only allowlisted labels may be applied.
 * 3. Comments must not be empty or consist only of whitespace.
 * 4. Comments must not contain unsafe patterns (script injection markers, etc.).
 * 5. Maximum label count is enforced.
 * 6. Prompt injection attempts in AI output cannot authorize extra writes.
 */
@Injectable()
export class TriagePolicyService {
  private readonly logger = new Logger(TriagePolicyService.name);

  /**
   * Validate a triage output against the repository's label set and policy config.
   *
   * @param output - The AI triage output to validate.
   * @param repositoryLabelNames - Names of all labels that exist in the repository.
   * @param config - Policy configuration.
   */
  validate(
    output: TriageOutput,
    repositoryLabelNames: string[],
    config: {
      labelAllowlist: string[] | null;
      maxLabels: number;
    },
  ): PolicyValidationResult {
    const repoLabelSet = new Set(repositoryLabelNames);
    const allowlistSet = config.labelAllowlist
      ? new Set(config.labelAllowlist)
      : null;

    const allowedLabels: string[] = [];
    const allowedLabelSet = new Set<string>();
    const rejectedLabels: Array<{ label: string; reason: string }> = [];
    const warnings: string[] = [];

    // Validate each suggested label
    for (const label of output.suggestedLabels) {
      if (allowedLabelSet.has(label)) {
        warnings.push(`Duplicate label '${label}' ignored`);
        continue;
      }

      if (!repoLabelSet.has(label)) {
        rejectedLabels.push({
          label,
          reason: `Label '${label}' does not exist in the repository`,
        });
        continue;
      }

      if (allowlistSet && !allowlistSet.has(label)) {
        rejectedLabels.push({
          label,
          reason: `Label '${label}' is not in the configured allowlist`,
        });
        continue;
      }

      allowedLabels.push(label);
      allowedLabelSet.add(label);
    }

    // Enforce maximum label count
    if (allowedLabels.length > config.maxLabels) {
      const excess = allowedLabels.splice(config.maxLabels);
      for (const label of excess) {
        rejectedLabels.push({
          label,
          reason: `Exceeds maximum label count of ${config.maxLabels}`,
        });
      }
      warnings.push(
        `Truncated labels to maximum of ${config.maxLabels} (${excess.length} removed)`,
      );
    }

    // Validate comment
    const commentValidation = this.validateComment(output.commentBody);

    if (rejectedLabels.length > 0) {
      this.logger.warn(
        `Policy rejected ${rejectedLabels.length} labels: ${rejectedLabels.map((r) => r.label).join(', ')}`,
      );
    }

    // A result is "valid" if there is at least some allowed action
    const valid = allowedLabels.length > 0 || commentValidation.allowed;

    return {
      valid,
      allowedLabels,
      rejectedLabels,
      commentAllowed: commentValidation.allowed,
      commentRejectionReason: commentValidation.reason,
      warnings,
    };
  }

  private validateComment(commentBody: string): {
    allowed: boolean;
    reason?: string;
  } {
    if (!commentBody || commentBody.trim().length === 0) {
      return { allowed: false, reason: 'Comment body is empty' };
    }

    // Reject HTML script tags (basic XSS protection)
    if (/<script[\s>]/i.test(commentBody)) {
      return {
        allowed: false,
        reason: 'Comment contains potentially unsafe HTML script tags',
      };
    }

    // Reject comments that are suspiciously short (likely injection artifact)
    if (commentBody.trim().length < 10) {
      return {
        allowed: false,
        reason: 'Comment body is too short to be a valid triage comment',
      };
    }

    return { allowed: true };
  }
}
