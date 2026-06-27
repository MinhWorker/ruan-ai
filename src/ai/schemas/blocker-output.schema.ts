import { BlockerOutput } from '../interfaces/blocker-output.interface';

export interface BlockerOutputValidationResult {
  valid: boolean;
  errors: string[];
  output: BlockerOutput | null;
}

const VALID_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;

export function validateBlockerOutput(
  raw: unknown,
): BlockerOutputValidationResult {
  const errors: string[] = [];

  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return {
      valid: false,
      errors: ['Input must be a non-null object'],
      output: null,
    };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.workflow !== 'blocker') {
    errors.push(`workflow must be 'blocker', got: ${String(obj.workflow)}`);
  }

  if (typeof obj.summary !== 'string') {
    errors.push('summary must be a string');
  }

  if (
    obj.likelyCause !== undefined &&
    obj.likelyCause !== null &&
    typeof obj.likelyCause !== 'string'
  ) {
    errors.push('likelyCause must be a string or null/undefined');
  }

  if (typeof obj.nextProvingMethod !== 'string') {
    errors.push('nextProvingMethod must be a string');
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

  checkArray('directHumanQuestions');
  checkArray('assumptions');

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

  return { valid: true, errors: [], output: obj as unknown as BlockerOutput };
}
