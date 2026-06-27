import { validateBlockerOutput } from './blocker-output.schema';

describe('validateBlockerOutput', () => {
  const validOutput = {
    workflow: 'blocker',
    summary: 'Blocked on X',
    likelyCause: 'Server down',
    nextProvingMethod: 'Check logs',
    directHumanQuestions: ['Is server down?'],
    commentBody: 'Blocked comment',
    confidence: 'high',
    assumptions: [],
    evidence: [{ source: 'issue', content: 'test', type: 'observed' }],
  };

  it('should validate a correct blocker output', () => {
    const result = validateBlockerOutput(validOutput);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.output).toBeDefined();
  });

  it('should allow null likelyCause', () => {
    const result = validateBlockerOutput({ ...validOutput, likelyCause: null });
    expect(result.valid).toBe(true);
  });

  it('should allow undefined likelyCause', () => {
    const noCause = { ...validOutput };
    delete (noCause as Record<string, unknown>).likelyCause;
    const result = validateBlockerOutput(noCause);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid fields', () => {
    const result = validateBlockerOutput({ ...validOutput, summary: 123 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('summary must be a string');
  });
});
