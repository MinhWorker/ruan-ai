import { validateSplitOutput } from './split-output.schema';

describe('validateSplitOutput', () => {
  const validOutput = {
    workflow: 'split',
    tasks: [
      {
        id: 'task-1',
        title: 'Define interfaces',
        objective: 'Create ts files under interfaces folder',
        filesToInspect: ['src/ai/interfaces/'],
        allowedOperations: ['create'],
        dependencies: [],
        parallelizationGuidance: 'Can start immediately.',
        verificationCommands: ['npm run build'],
        completionEvidence: 'Files compiled successfully.',
        ownerType: 'coding_agent',
      },
      {
        id: 'task-2',
        title: 'Add tests',
        objective: 'Write schema validation tests',
        filesToInspect: ['src/ai/schemas/'],
        allowedOperations: ['create', 'edit'],
        dependencies: ['task-1'],
        parallelizationGuidance: 'Must run after task-1.',
        verificationCommands: ['npx jest'],
        completionEvidence: 'Tests passed.',
        ownerType: 'coding_agent',
      },
    ],
    commentBody: 'Split completed.',
    confidence: 'high',
    assumptions: [],
    evidence: [{ source: 'plan', content: 'Tasks split' }],
  };

  it('should validate a correct split output', () => {
    const result = validateSplitOutput(validOutput);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.output).not.toBeNull();
    expect(result.output!.workflow).toBe('split');
  });

  it('should reject non-existent task ID in dependencies', () => {
    const invalidOutput = {
      ...validOutput,
      tasks: [
        {
          ...validOutput.tasks[0],
          dependencies: ['non-existent-task-id'],
        },
      ],
    };
    const result = validateSplitOutput(invalidOutput);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) =>
        e.includes('references a non-existent task ID'),
      ),
    ).toBe(true);
  });

  it('should reject invalid ownerType in tasks', () => {
    const invalidOutput = {
      ...validOutput,
      tasks: [
        {
          ...validOutput.tasks[0],
          ownerType: 'invalid_owner',
        },
      ],
    };
    const result = validateSplitOutput(invalidOutput);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('ownerType'))).toBe(true);
  });
});
