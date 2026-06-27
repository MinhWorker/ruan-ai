import { SplitOutput } from '../interfaces/split-output.interface';

const VALID_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
const VALID_OWNER_TYPES = ['human', 'coding_agent', 'blocked'] as const;
const REQUIRED_KEYS = [
  'workflow',
  'tasks',
  'commentBody',
  'confidence',
  'assumptions',
  'evidence',
] as const;

export interface SplitOutputValidationResult {
  valid: boolean;
  errors: string[];
  output: SplitOutput | null;
}

export function validateSplitOutput(raw: unknown): SplitOutputValidationResult {
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
  if (obj.workflow !== 'split') {
    errors.push(`workflow must be 'split', got: ${String(obj.workflow)}`);
  }

  // tasks
  const taskIds = new Set<string>();
  if (!Array.isArray(obj.tasks)) {
    errors.push('tasks must be an array');
  } else {
    for (let i = 0; i < obj.tasks.length; i++) {
      const task = obj.tasks[i] as Record<string, unknown> | undefined;
      if (!task || typeof task !== 'object') {
        errors.push(`tasks[${i}] must be an object`);
        continue;
      }

      // id
      if (typeof task.id !== 'string' || task.id.trim().length === 0) {
        errors.push(`tasks[${i}].id must be a non-empty string`);
      } else {
        taskIds.add(task.id);
      }

      // title
      if (typeof task.title !== 'string' || task.title.trim().length === 0) {
        errors.push(`tasks[${i}].title must be a non-empty string`);
      }

      // objective
      if (
        typeof task.objective !== 'string' ||
        task.objective.trim().length === 0
      ) {
        errors.push(`tasks[${i}].objective must be a non-empty string`);
      }

      // filesToInspect
      if (!Array.isArray(task.filesToInspect)) {
        errors.push(`tasks[${i}].filesToInspect must be an array`);
      } else {
        for (let j = 0; j < task.filesToInspect.length; j++) {
          if (typeof task.filesToInspect[j] !== 'string') {
            errors.push(`tasks[${i}].filesToInspect[${j}] must be a string`);
          }
        }
      }

      // allowedOperations
      if (!Array.isArray(task.allowedOperations)) {
        errors.push(`tasks[${i}].allowedOperations must be an array`);
      } else {
        for (let j = 0; j < task.allowedOperations.length; j++) {
          if (typeof task.allowedOperations[j] !== 'string') {
            errors.push(`tasks[${i}].allowedOperations[${j}] must be a string`);
          }
        }
      }

      // dependencies
      if (!Array.isArray(task.dependencies)) {
        errors.push(`tasks[${i}].dependencies must be an array`);
      } else {
        for (let j = 0; j < task.dependencies.length; j++) {
          if (typeof task.dependencies[j] !== 'string') {
            errors.push(`tasks[${i}].dependencies[${j}] must be a string`);
          }
        }
      }

      // parallelizationGuidance
      if (typeof task.parallelizationGuidance !== 'string') {
        errors.push(`tasks[${i}].parallelizationGuidance must be a string`);
      }

      // verificationCommands
      if (!Array.isArray(task.verificationCommands)) {
        errors.push(`tasks[${i}].verificationCommands must be an array`);
      } else {
        for (let j = 0; j < task.verificationCommands.length; j++) {
          if (typeof task.verificationCommands[j] !== 'string') {
            errors.push(
              `tasks[${i}].verificationCommands[${j}] must be a string`,
            );
          }
        }
      }

      // completionEvidence
      if (typeof task.completionEvidence !== 'string') {
        errors.push(`tasks[${i}].completionEvidence must be a string`);
      }

      // ownerType
      if (
        !VALID_OWNER_TYPES.includes(
          task.ownerType as (typeof VALID_OWNER_TYPES)[number],
        )
      ) {
        errors.push(
          `tasks[${i}].ownerType must be one of ${VALID_OWNER_TYPES.join(', ')}, got: ${String(task.ownerType)}`,
        );
      }
    }

    // Now validate that all dependencies reference existing tasks in the list
    for (let i = 0; i < obj.tasks.length; i++) {
      const task = obj.tasks[i] as Record<string, unknown> | undefined;
      if (task && Array.isArray(task.dependencies)) {
        const deps = task.dependencies as unknown[];
        for (let j = 0; j < deps.length; j++) {
          const dep = deps[j];
          if (typeof dep === 'string' && dep.length > 0 && !taskIds.has(dep)) {
            errors.push(
              `tasks[${i}].dependencies[${j}] references a non-existent task ID: "${dep}"`,
            );
          }
        }
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
    output: obj as unknown as SplitOutput,
  };
}
