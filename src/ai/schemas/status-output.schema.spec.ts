import { validateStatusOutput } from './status-output.schema';

describe('validateStatusOutput', () => {
  const validOutput = {
    workflow: 'status',
    state: 'in_progress',
    completedWork: ['A'],
    openTasks: ['B'],
    blockers: [],
    nextAction: 'Do C',
    commentBody: 'Status is good',
    confidence: 'high',
    assumptions: [],
    evidence: [{ source: 'issue', content: 'test', type: 'observed' }],
  };

  it('should validate a correct status output', () => {
    const result = validateStatusOutput(validOutput);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.output).toBeDefined();
  });

  it('should reject invalid state', () => {
    const result = validateStatusOutput({ ...validOutput, state: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('state must be one of');
  });

  it('should reject missing fields', () => {
    const missingState = { ...validOutput };
    delete (missingState as Record<string, unknown>).state;
    const result = validateStatusOutput(missingState);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid evidence type', () => {
    const result = validateStatusOutput({
      ...validOutput,
      evidence: [{ source: 'issue', content: 'test', type: 'magic' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(
      "evidence[0].type must be 'observed' or 'inferred'",
    );
  });
});
