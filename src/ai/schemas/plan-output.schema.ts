import { PlanOutput } from '../interfaces/plan-output.interface';

const VALID_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
const REQUIRED_KEYS = [
  'workflow',
  'problemStatement',
  'scope',
  'nonScope',
  'dependencies',
  'taskSequence',
  'acceptanceCriteria',
  'verificationStrategy',
  'humanDecisions',
  'commentBody',
  'confidence',
  'assumptions',
  'evidence',
] as const;

export interface PlanOutputValidationResult {
  valid: boolean;
  errors: string[];
  output: PlanOutput | null;
}

export function validatePlanOutput(raw: unknown): PlanOutputValidationResult {
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
  if (obj.workflow !== 'plan') {
    errors.push(`workflow must be 'plan', got: ${String(obj.workflow)}`);
  }

  // problemStatement
  if (
    typeof obj.problemStatement !== 'string' ||
    obj.problemStatement.trim().length === 0
  ) {
    errors.push('problemStatement must be a non-empty string');
  }

  // scope
  if (!Array.isArray(obj.scope)) {
    errors.push('scope must be an array');
  } else {
    for (let i = 0; i < obj.scope.length; i++) {
      if (typeof obj.scope[i] !== 'string') {
        errors.push(`scope[${i}] must be a string`);
      }
    }
  }

  // nonScope
  if (!Array.isArray(obj.nonScope)) {
    errors.push('nonScope must be an array');
  } else {
    for (let i = 0; i < obj.nonScope.length; i++) {
      if (typeof obj.nonScope[i] !== 'string') {
        errors.push(`nonScope[${i}] must be a string`);
      }
    }
  }

  // dependencies
  if (!Array.isArray(obj.dependencies)) {
    errors.push('dependencies must be an array');
  } else {
    for (let i = 0; i < obj.dependencies.length; i++) {
      if (typeof obj.dependencies[i] !== 'string') {
        errors.push(`dependencies[${i}] must be a string`);
      }
    }
  }

  // taskSequence
  if (!Array.isArray(obj.taskSequence)) {
    errors.push('taskSequence must be an array');
  } else {
    for (let i = 0; i < obj.taskSequence.length; i++) {
      if (typeof obj.taskSequence[i] !== 'string') {
        errors.push(`taskSequence[${i}] must be a string`);
      }
    }
  }

  // acceptanceCriteria
  if (!Array.isArray(obj.acceptanceCriteria)) {
    errors.push('acceptanceCriteria must be an array');
  } else {
    for (let i = 0; i < obj.acceptanceCriteria.length; i++) {
      if (typeof obj.acceptanceCriteria[i] !== 'string') {
        errors.push(`acceptanceCriteria[${i}] must be a string`);
      }
    }
  }

  // verificationStrategy
  if (
    typeof obj.verificationStrategy !== 'string' ||
    obj.verificationStrategy.trim().length === 0
  ) {
    errors.push('verificationStrategy must be a non-empty string');
  }

  // humanDecisions
  if (!Array.isArray(obj.humanDecisions)) {
    errors.push('humanDecisions must be an array');
  } else {
    for (let i = 0; i < obj.humanDecisions.length; i++) {
      if (typeof obj.humanDecisions[i] !== 'string') {
        errors.push(`humanDecisions[${i}] must be a string`);
      }
    }
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
    output: obj as unknown as PlanOutput,
  };
}
