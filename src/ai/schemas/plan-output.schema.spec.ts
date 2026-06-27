import { validatePlanOutput } from './plan-output.schema';

describe('validatePlanOutput', () => {
  const validOutput = {
    workflow: 'plan',
    problemStatement: 'Integrate Milestone 3 features.',
    scope: ['implement plan workflow', 'implement split workflow'],
    nonScope: ['telemetry', 'status command'],
    dependencies: ['milestone 2'],
    taskSequence: ['1. define interfaces', '2. validate schemas'],
    acceptanceCriteria: ['all unit tests pass', 'e2e tests pass'],
    verificationStrategy: 'Run npm run test and npm run test:e2e.',
    humanDecisions: [],
    commentBody: 'Active plan proposed.',
    confidence: 'high',
    assumptions: [],
    evidence: [{ source: 'issue_title', content: 'Milestone 3' }],
  };

  it('should validate a correct plan output', () => {
    const result = validatePlanOutput(validOutput);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.output).not.toBeNull();
    expect(result.output!.workflow).toBe('plan');
  });

  it('should reject null/undefined/non-object input', () => {
    expect(validatePlanOutput(null).valid).toBe(false);
    expect(validatePlanOutput(undefined).valid).toBe(false);
    expect(validatePlanOutput('not an object').valid).toBe(false);
  });

  it('should reject incorrect workflow value', () => {
    const result = validatePlanOutput({ ...validOutput, workflow: 'triage' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('workflow'))).toBe(true);
  });

  it('should reject unexpected fields', () => {
    const result = validatePlanOutput({
      ...validOutput,
      extraField: 'unwanted',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unexpected field: extraField');
  });

  it('should reject empty problemStatement', () => {
    const result = validatePlanOutput({ ...validOutput, problemStatement: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('problemStatement'))).toBe(
      true,
    );
  });

  it('should reject invalid confidence', () => {
    const result = validatePlanOutput({ ...validOutput, confidence: 'none' });
    expect(result.valid).toBe(false);
  });
});
