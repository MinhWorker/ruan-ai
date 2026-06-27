import { Injectable, Logger, Optional } from '@nestjs/common';
import { TriageOutput } from '../../ai/interfaces/triage-output.interface';
import { PlanOutput } from '../../ai/interfaces/plan-output.interface';
import { SplitOutput } from '../../ai/interfaces/split-output.interface';
import { StatusOutput } from '../../ai/interfaces/status-output.interface';
import { BlockerOutput } from '../../ai/interfaces/blocker-output.interface';
import { PolicyValidationResult } from '../interfaces/policy-validation-result.interface';
import { TelemetryService } from '../../telemetry/services/telemetry.service';

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

  constructor(
    @Optional() private readonly telemetryService?: TelemetryService,
  ) {}

  private recordPolicyDecision(
    workflow: string,
    result: PolicyValidationResult,
  ) {
    if (this.telemetryService) {
      this.telemetryService.recordEvent({
        type: 'policy_decision',
        severity: result.valid ? 'info' : 'warn',
        message: `Policy decision for ${workflow}: ${result.valid ? 'allowed' : 'rejected'}`,
        metadata: {
          workflow,
          valid: result.valid,
          rejectedLabels: result.rejectedLabels,
          commentRejectionReason: result.commentRejectionReason,
        },
      });
    }
  }

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

    const result: PolicyValidationResult = {
      valid,
      allowedLabels,
      rejectedLabels,
      commentAllowed: commentValidation.allowed,
      commentRejectionReason: commentValidation.reason,
      warnings,
    };
    this.recordPolicyDecision('triage', result);
    return result;
  }

  validatePlan(output: PlanOutput): PolicyValidationResult {
    const commentValidation = this.validateComment(output.commentBody);
    const result: PolicyValidationResult = {
      valid: commentValidation.allowed,
      allowedLabels: [],
      rejectedLabels: [],
      commentAllowed: commentValidation.allowed,
      commentRejectionReason: commentValidation.reason,
      warnings: [],
    };
    this.recordPolicyDecision('plan', result);
    return result;
  }

  validateSplit(
    output: SplitOutput,
    hasActivePlan: boolean,
  ): PolicyValidationResult {
    const warnings: string[] = [];

    // Rule: Workflow transition validation - Split requires an active plan
    if (!hasActivePlan) {
      this.logger.warn(
        'Workflow transition rejected: Split requires an active plan',
      );
      const result: PolicyValidationResult = {
        valid: false,
        allowedLabels: [],
        rejectedLabels: [],
        commentAllowed: false,
        commentRejectionReason:
          'Split workflow transition is not allowed without an active plan',
        warnings: ['No active plan found on the issue'],
      };
      this.recordPolicyDecision('split', result);
      return result;
    }

    // Rule: Validate task handoff output does not authorize direct repository mutation
    const safeOperations = new Set([
      'create',
      'edit',
      'view',
      'inspect',
      'read',
    ]);
    let allTasksSafe = true;
    for (const task of output.tasks) {
      for (const op of task.allowedOperations) {
        if (!safeOperations.has(op.toLowerCase())) {
          allTasksSafe = false;
          warnings.push(
            `Task ${task.id} requests unauthorized repository mutation: "${op}"`,
          );
        }
      }
    }

    const commentValidation = this.validateComment(output.commentBody);
    const commentAllowed = commentValidation.allowed && allTasksSafe;
    const commentRejectionReason = !allTasksSafe
      ? 'Split contains tasks requesting unauthorized operations'
      : commentValidation.reason;

    const result: PolicyValidationResult = {
      valid: commentAllowed,
      allowedLabels: [],
      rejectedLabels: [],
      commentAllowed,
      commentRejectionReason,
      warnings,
    };
    this.recordPolicyDecision('split', result);
    return result;
  }

  validateStatus(output: StatusOutput): PolicyValidationResult {
    const commentValidation = this.validateComment(output.commentBody);
    const result: PolicyValidationResult = {
      valid: commentValidation.allowed,
      allowedLabels: [],
      rejectedLabels: [],
      commentAllowed: commentValidation.allowed,
      commentRejectionReason: commentValidation.reason,
      warnings: [],
    };
    this.recordPolicyDecision('status', result);
    return result;
  }

  validateBlocker(output: BlockerOutput): PolicyValidationResult {
    const commentValidation = this.validateComment(output.commentBody);
    const result: PolicyValidationResult = {
      valid: commentValidation.allowed,
      allowedLabels: [],
      rejectedLabels: [],
      commentAllowed: commentValidation.allowed,
      commentRejectionReason: commentValidation.reason,
      warnings: [],
    };
    this.recordPolicyDecision('blocker', result);
    return result;
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
