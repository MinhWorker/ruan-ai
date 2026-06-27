import { StatusOutput } from '../interfaces/status-output.interface';

export interface StatusOutputValidationResult {
  valid: boolean;
  errors: string[];
  output: StatusOutput | null;
}

const VALID_STATES = [
  'not_started',
  'ready',
  'in_progress',
  'blocked',
  'needs_review',
  'done',
  'paused',
] as const;
const VALID_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;

export function validateStatusOutput(
  raw: unknown,
): StatusOutputValidationResult {
  const errors: string[] = [];

  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return {
      valid: false,
      errors: ['Input must be a non-null object'],
      output: null,
    };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.workflow !== 'status') {
    errors.push(`workflow must be 'status', got: ${String(obj.workflow)}`);
  }

  if (!VALID_STATES.includes(obj.state as (typeof VALID_STATES)[number])) {
    errors.push(`state must be one of ${VALID_STATES.join(', ')}`);
  }

  const checkArray = (key: string) => {
    if (!Array.isArray(obj[key])) {
      errors.push(`${key} must be an array`);
    } else {
      for (let i = 0; i < obj[key].length; i++) {
        if (typeof obj[key][i] !== 'string') {
          errors.push(`${key}[${i}] must be a string`);
        }
      }
    }
  };

  checkArray('completedWork');
  checkArray('openTasks');
  checkArray('blockers');
  checkArray('assumptions');

  if (typeof obj.nextAction !== 'string') {
    errors.push('nextAction must be a string');
  }

  if (
    typeof obj.commentBody !== 'string' ||
    obj.commentBody.trim().length === 0
  ) {
    errors.push('commentBody must be a non-empty string');
  }

  if (
    !VALID_CONFIDENCE_LEVELS.includes(
      obj.confidence as (typeof VALID_CONFIDENCE_LEVELS)[number],
    )
  ) {
    errors.push(
      `confidence must be one of ${VALID_CONFIDENCE_LEVELS.join(', ')}`,
    );
  }

  if (!Array.isArray(obj.evidence)) {
    errors.push('evidence must be an array');
  } else {
    for (let i = 0; i < obj.evidence.length; i++) {
      const ev = obj.evidence[i] as Record<string, unknown>;
      if (!ev || typeof ev !== 'object') {
        errors.push(`evidence[${i}] must be an object`);
      } else {
        if (typeof ev.source !== 'string') {
          errors.push(`evidence[${i}].source must be a string`);
        }
        if (typeof ev.content !== 'string') {
          errors.push(`evidence[${i}].content must be a string`);
        }
        if (ev.type !== 'observed' && ev.type !== 'inferred') {
          errors.push(`evidence[${i}].type must be 'observed' or 'inferred'`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, output: null };
  }

  return { valid: true, errors: [], output: obj as unknown as StatusOutput };
}
