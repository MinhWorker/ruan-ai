import { TriageOutput } from '../interfaces/triage-output.interface';

const VALID_RISK_LEVELS = ['low', 'medium', 'high'] as const;
const VALID_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
const VALID_NEXT_COMMANDS = ['/plan', 'human_clarification'] as const;
const REQUIRED_KEYS = [
  'workflow',
  'summary',
  'riskLevel',
  'suggestedLabels',
  'missingInformation',
  'recommendedNextCommand',
  'commentBody',
  'confidence',
  'assumptions',
  'evidence',
] as const;

/**
 * Validation result for triage output schema.
 */
export interface TriageOutputValidationResult {
  valid: boolean;
  errors: string[];
  output: TriageOutput | null;
}

/**
 * Validates raw parsed JSON against the TriageOutput schema.
 * Returns a typed result with validation errors if any.
 *
 * This is a strict validator: all required fields must be present
 * and correctly typed. No coercion or default filling.
 */
export function validateTriageOutput(
  raw: unknown,
): TriageOutputValidationResult {
  const errors: string[] = [];

  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return {
      valid: false,
      errors: ['Input must be a non-null object'],
      output: null,
    };
  }

  const obj = raw as Record<string, unknown>;
  const allowedKeys = new Set<string>(REQUIRED_KEYS);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unexpected field: ${key}`);
    }
  }

  // workflow
  if (obj.workflow !== 'triage') {
    errors.push(`workflow must be 'triage', got: ${String(obj.workflow)}`);
  }

  // summary
  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) {
    errors.push('summary must be a non-empty string');
  }

  // riskLevel
  if (
    !VALID_RISK_LEVELS.includes(
      obj.riskLevel as (typeof VALID_RISK_LEVELS)[number],
    )
  ) {
    errors.push(
      `riskLevel must be one of ${VALID_RISK_LEVELS.join(', ')}, got: ${String(obj.riskLevel)}`,
    );
  }

  // suggestedLabels
  if (!Array.isArray(obj.suggestedLabels)) {
    errors.push('suggestedLabels must be an array');
  } else {
    for (let i = 0; i < obj.suggestedLabels.length; i++) {
      if (typeof obj.suggestedLabels[i] !== 'string') {
        errors.push(`suggestedLabels[${i}] must be a string`);
      }
    }
  }

  // missingInformation
  if (!Array.isArray(obj.missingInformation)) {
    errors.push('missingInformation must be an array');
  } else {
    for (let i = 0; i < obj.missingInformation.length; i++) {
      if (typeof obj.missingInformation[i] !== 'string') {
        errors.push(`missingInformation[${i}] must be a string`);
      }
    }
  }

  // recommendedNextCommand
  if (
    !VALID_NEXT_COMMANDS.includes(
      obj.recommendedNextCommand as (typeof VALID_NEXT_COMMANDS)[number],
    )
  ) {
    errors.push(
      `recommendedNextCommand must be one of ${VALID_NEXT_COMMANDS.join(', ')}, got: ${String(obj.recommendedNextCommand)}`,
    );
  }

  // commentBody
  if (
    typeof obj.commentBody !== 'string' ||
    obj.commentBody.trim().length === 0
  ) {
    errors.push('commentBody must be a non-empty string');
  }

  // confidence
  if (
    !VALID_CONFIDENCE_LEVELS.includes(
      obj.confidence as (typeof VALID_CONFIDENCE_LEVELS)[number],
    )
  ) {
    errors.push(
      `confidence must be one of ${VALID_CONFIDENCE_LEVELS.join(', ')}, got: ${String(obj.confidence)}`,
    );
  }

  // assumptions
  if (!Array.isArray(obj.assumptions)) {
    errors.push('assumptions must be an array');
  } else {
    for (let i = 0; i < obj.assumptions.length; i++) {
      if (typeof obj.assumptions[i] !== 'string') {
        errors.push(`assumptions[${i}] must be a string`);
      }
    }
  }

  // evidence
  if (!Array.isArray(obj.evidence)) {
    errors.push('evidence must be an array');
  } else {
    for (let i = 0; i < obj.evidence.length; i++) {
      const ev = obj.evidence[i] as Record<string, unknown> | undefined;
      if (!ev || typeof ev !== 'object') {
        errors.push(`evidence[${i}] must be an object`);
      } else {
        if (typeof ev.source !== 'string') {
          errors.push(`evidence[${i}].source must be a string`);
        }
        if (typeof ev.content !== 'string') {
          errors.push(`evidence[${i}].content must be a string`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, output: null };
  }

  return {
    valid: true,
    errors: [],
    output: obj as unknown as TriageOutput,
  };
}
