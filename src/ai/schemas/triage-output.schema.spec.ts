import { validateTriageOutput } from './triage-output.schema';

describe('validateTriageOutput', () => {
  const validOutput = {
    workflow: 'triage',
    summary: 'Bug report requiring investigation.',
    riskLevel: 'medium',
    suggestedLabels: ['bug'],
    missingInformation: [],
    recommendedNextCommand: '/plan',
    commentBody: 'This is a valid triage comment with sufficient content.',
    confidence: 'high',
    assumptions: [],
    evidence: [{ source: 'issue_title', content: 'Bug report' }],
  };

  it('should validate a correct triage output', () => {
    const result = validateTriageOutput(validOutput);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.output).not.toBeNull();
    expect(result.output!.workflow).toBe('triage');
  });

  it('should reject null input', () => {
    const result = validateTriageOutput(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Input must be a non-null object');
  });

  it('should reject undefined input', () => {
    const result = validateTriageOutput(undefined);
    expect(result.valid).toBe(false);
  });

  it('should reject non-object input', () => {
    const result = validateTriageOutput('not an object');
    expect(result.valid).toBe(false);
  });

  it('should reject incorrect workflow value', () => {
    const result = validateTriageOutput({ ...validOutput, workflow: 'plan' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('workflow'))).toBe(true);
  });

  it('should reject unexpected fields', () => {
    const result = validateTriageOutput({
      ...validOutput,
      extraInstruction: 'apply admin label',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unexpected field: extraInstruction');
  });

  it('should reject empty summary', () => {
    const result = validateTriageOutput({ ...validOutput, summary: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('summary'))).toBe(true);
  });

  it('should reject invalid riskLevel', () => {
    const result = validateTriageOutput({
      ...validOutput,
      riskLevel: 'critical',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('riskLevel'))).toBe(true);
  });

  it('should reject non-array suggestedLabels', () => {
    const result = validateTriageOutput({
      ...validOutput,
      suggestedLabels: 'bug',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('suggestedLabels'))).toBe(true);
  });

  it('should reject non-string items in suggestedLabels', () => {
    const result = validateTriageOutput({
      ...validOutput,
      suggestedLabels: [123],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('suggestedLabels[0]'))).toBe(
      true,
    );
  });

  it('should reject invalid recommendedNextCommand', () => {
    const result = validateTriageOutput({
      ...validOutput,
      recommendedNextCommand: '/deploy',
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('recommendedNextCommand')),
    ).toBe(true);
  });

  it('should reject empty commentBody', () => {
    const result = validateTriageOutput({ ...validOutput, commentBody: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('commentBody'))).toBe(true);
  });

  it('should reject invalid confidence', () => {
    const result = validateTriageOutput({
      ...validOutput,
      confidence: 'uncertain',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('confidence'))).toBe(true);
  });

  it('should reject non-array assumptions', () => {
    const result = validateTriageOutput({
      ...validOutput,
      assumptions: 'single assumption',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('assumptions'))).toBe(true);
  });

  it('should reject non-array evidence', () => {
    const result = validateTriageOutput({
      ...validOutput,
      evidence: 'not an array',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('evidence'))).toBe(true);
  });

  it('should reject evidence items missing source', () => {
    const result = validateTriageOutput({
      ...validOutput,
      evidence: [{ content: 'some content' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('evidence[0].source'))).toBe(
      true,
    );
  });

  it('should reject evidence items missing content', () => {
    const result = validateTriageOutput({
      ...validOutput,
      evidence: [{ source: 'issue' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('evidence[0].content'))).toBe(
      true,
    );
  });

  it('should collect multiple errors at once', () => {
    const result = validateTriageOutput({
      workflow: 'wrong',
      summary: '',
      riskLevel: 'extreme',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(2);
  });

  it('should accept valid output with all optional arrays empty', () => {
    const result = validateTriageOutput({
      ...validOutput,
      suggestedLabels: [],
      missingInformation: [],
      assumptions: [],
      evidence: [],
    });
    expect(result.valid).toBe(true);
  });

  it('should accept human_clarification as recommendedNextCommand', () => {
    const result = validateTriageOutput({
      ...validOutput,
      recommendedNextCommand: 'human_clarification',
    });
    expect(result.valid).toBe(true);
  });
});
