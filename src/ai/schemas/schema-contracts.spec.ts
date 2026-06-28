import { getSchemaContract } from './schema-contracts';

describe('getSchemaContract', () => {
  const workflows = ['triage', 'plan', 'split', 'status', 'blocker'] as const;

  for (const workflow of workflows) {
    describe(`${workflow} contract`, () => {
      it(`should return a non-empty string for ${workflow}`, () => {
        const contract = getSchemaContract(workflow);
        expect(typeof contract).toBe('string');
        expect(contract.length).toBeGreaterThan(100);
      });

      it(`should reference the "${workflow}" workflow discriminator`, () => {
        const contract = getSchemaContract(workflow);
        expect(contract).toContain(`"workflow": "${workflow}"`);
      });

      it(`should mention "commentBody" as a required field`, () => {
        const contract = getSchemaContract(workflow);
        expect(contract).toContain('commentBody');
      });

      it(`should mention "confidence" as a required field`, () => {
        const contract = getSchemaContract(workflow);
        expect(contract).toContain('confidence');
      });

      it(`should mention "evidence" as a required field`, () => {
        const contract = getSchemaContract(workflow);
        expect(contract).toContain('evidence');
      });

      it(`should mention "assumptions" as a required field`, () => {
        const contract = getSchemaContract(workflow);
        expect(contract).toContain('assumptions');
      });
    });
  }

  describe('triage-specific fields', () => {
    it('should include triage-specific required fields', () => {
      const contract = getSchemaContract('triage');
      expect(contract).toContain('summary');
      expect(contract).toContain('riskLevel');
      expect(contract).toContain('suggestedLabels');
      expect(contract).toContain('missingInformation');
      expect(contract).toContain('recommendedNextCommand');
    });
  });

  describe('plan-specific fields', () => {
    it('should include plan-specific required fields', () => {
      const contract = getSchemaContract('plan');
      expect(contract).toContain('problemStatement');
      expect(contract).toContain('scope');
      expect(contract).toContain('nonScope');
      expect(contract).toContain('taskSequence');
      expect(contract).toContain('acceptanceCriteria');
      expect(contract).toContain('verificationStrategy');
      expect(contract).toContain('humanDecisions');
    });
  });

  describe('split-specific fields', () => {
    it('should include split-specific required fields', () => {
      const contract = getSchemaContract('split');
      expect(contract).toContain('tasks');
      expect(contract).toContain('ownerType');
      expect(contract).toContain('filesToInspect');
      expect(contract).toContain('verificationCommands');
      expect(contract).toContain('"create", "edit", "view", "inspect", "read"');
    });
  });

  describe('status-specific fields', () => {
    it('should include status-specific required fields', () => {
      const contract = getSchemaContract('status');
      expect(contract).toContain('state');
      expect(contract).toContain('completedWork');
      expect(contract).toContain('openTasks');
      expect(contract).toContain('blockers');
      expect(contract).toContain('nextAction');
    });
  });

  describe('blocker-specific fields', () => {
    it('should include blocker-specific required fields', () => {
      const contract = getSchemaContract('blocker');
      expect(contract).toContain('summary');
      expect(contract).toContain('likelyCause');
      expect(contract).toContain('nextProvingMethod');
      expect(contract).toContain('directHumanQuestions');
    });
  });

  it('should throw for an unknown workflow', () => {
    expect(() => getSchemaContract('unknown')).toThrow(
      'No schema contract defined for workflow: unknown',
    );
  });
});
