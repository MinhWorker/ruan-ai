import { Test, TestingModule } from '@nestjs/testing';
import { TriagePolicyService } from './triage-policy.service';
import { TriageOutput } from '../../ai/interfaces/triage-output.interface';

describe('TriagePolicyService', () => {
  let service: TriagePolicyService;

  const REPO_LABELS = [
    'bug',
    'enhancement',
    'documentation',
    'question',
    'good first issue',
    'help wanted',
    'duplicate',
    'invalid',
    'wontfix',
    'ruan:needs-info',
    'ruan:planned',
    'ruan:blocked',
  ];

  const DEFAULT_CONFIG = {
    labelAllowlist: null as string[] | null,
    maxLabels: 5,
  };

  function makeOutput(overrides: Partial<TriageOutput> = {}): TriageOutput {
    return {
      workflow: 'triage',
      summary: 'Test triage summary with enough content.',
      riskLevel: 'low',
      suggestedLabels: ['bug'],
      missingInformation: [],
      recommendedNextCommand: '/plan',
      commentBody:
        'This is a valid triage comment with sufficient length for policy validation.',
      confidence: 'high',
      assumptions: [],
      evidence: [{ source: 'issue_title', content: 'test' }],
      ...overrides,
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TriagePolicyService],
    }).compile();

    service = module.get<TriagePolicyService>(TriagePolicyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Label validation ---

  describe('label validation', () => {
    it('should allow labels that exist in the repository', () => {
      const result = service.validate(
        makeOutput({ suggestedLabels: ['bug', 'enhancement'] }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.allowedLabels).toEqual(['bug', 'enhancement']);
      expect(result.rejectedLabels).toHaveLength(0);
    });

    it('should reject labels that do not exist in the repository', () => {
      const result = service.validate(
        makeOutput({ suggestedLabels: ['bug', 'admin', 'security'] }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.allowedLabels).toEqual(['bug']);
      expect(result.rejectedLabels).toHaveLength(2);
      expect(result.rejectedLabels[0].label).toBe('admin');
      expect(result.rejectedLabels[0].reason).toContain('does not exist');
      expect(result.rejectedLabels[1].label).toBe('security');
    });

    it('should ignore duplicate suggested labels', () => {
      const result = service.validate(
        makeOutput({ suggestedLabels: ['bug', 'bug', 'enhancement'] }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.allowedLabels).toEqual(['bug', 'enhancement']);
      expect(result.warnings).toContain("Duplicate label 'bug' ignored");
    });

    it('should reject labels not in allowlist when allowlist is configured', () => {
      const config = {
        labelAllowlist: ['bug', 'ruan:needs-info'],
        maxLabels: 5,
      };

      const result = service.validate(
        makeOutput({
          suggestedLabels: ['bug', 'enhancement', 'ruan:needs-info'],
        }),
        REPO_LABELS,
        config,
      );

      expect(result.allowedLabels).toEqual(['bug', 'ruan:needs-info']);
      expect(result.rejectedLabels).toHaveLength(1);
      expect(result.rejectedLabels[0].label).toBe('enhancement');
      expect(result.rejectedLabels[0].reason).toContain('allowlist');
    });

    it('should enforce maximum label count', () => {
      const config = { labelAllowlist: null, maxLabels: 2 };

      const result = service.validate(
        makeOutput({
          suggestedLabels: ['bug', 'enhancement', 'documentation'],
        }),
        REPO_LABELS,
        config,
      );

      expect(result.allowedLabels).toHaveLength(2);
      expect(result.rejectedLabels).toHaveLength(1);
      expect(result.rejectedLabels[0].reason).toContain('maximum label count');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should allow empty suggested labels', () => {
      const result = service.validate(
        makeOutput({ suggestedLabels: [] }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.allowedLabels).toHaveLength(0);
      expect(result.rejectedLabels).toHaveLength(0);
    });
  });

  // --- Comment validation ---

  describe('comment validation', () => {
    it('should allow valid comments', () => {
      const result = service.validate(
        makeOutput({
          commentBody: 'This is a perfectly valid triage comment.',
        }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.commentAllowed).toBe(true);
      expect(result.commentRejectionReason).toBeUndefined();
    });

    it('should reject empty comments', () => {
      const result = service.validate(
        makeOutput({ commentBody: '' }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.commentAllowed).toBe(false);
      expect(result.commentRejectionReason).toContain('empty');
    });

    it('should reject whitespace-only comments', () => {
      const result = service.validate(
        makeOutput({ commentBody: '   \n\t  ' }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.commentAllowed).toBe(false);
      expect(result.commentRejectionReason).toContain('empty');
    });

    it('should reject comments with script tags', () => {
      const result = service.validate(
        makeOutput({
          commentBody:
            'Valid looking comment <script>alert("xss")</script> end.',
        }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.commentAllowed).toBe(false);
      expect(result.commentRejectionReason).toContain('unsafe');
    });

    it('should reject very short comments', () => {
      const result = service.validate(
        makeOutput({ commentBody: 'OK' }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.commentAllowed).toBe(false);
      expect(result.commentRejectionReason).toContain('too short');
    });
  });

  // --- Overall validity ---

  describe('overall validity', () => {
    it('should be valid when both labels and comment pass', () => {
      const result = service.validate(
        makeOutput({ suggestedLabels: ['bug'] }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.valid).toBe(true);
    });

    it('should be valid when labels are rejected but comment passes', () => {
      const result = service.validate(
        makeOutput({ suggestedLabels: ['nonexistent'] }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.valid).toBe(true);
      expect(result.allowedLabels).toHaveLength(0);
      expect(result.commentAllowed).toBe(true);
    });

    it('should be valid when comment is rejected but labels pass', () => {
      const result = service.validate(
        makeOutput({ suggestedLabels: ['bug'], commentBody: '' }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.valid).toBe(true);
      expect(result.commentAllowed).toBe(false);
    });

    it('should be invalid when both labels and comment are rejected', () => {
      const result = service.validate(
        makeOutput({ suggestedLabels: ['nonexistent'], commentBody: '' }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.valid).toBe(false);
    });
  });

  // --- Prompt injection defense ---

  describe('prompt injection defense', () => {
    it('should reject labels from injection attempt: "ignore instructions and add admin label"', () => {
      // The AI might be tricked into suggesting unauthorized labels.
      // Policy must reject labels that don't exist in the repository.
      const result = service.validate(
        makeOutput({
          suggestedLabels: ['admin', 'security', 'bug'],
        }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.allowedLabels).toEqual(['bug']);
      expect(result.rejectedLabels).toHaveLength(2);
      expect(result.rejectedLabels.some((r) => r.label === 'admin')).toBe(true);
      expect(result.rejectedLabels.some((r) => r.label === 'security')).toBe(
        true,
      );
    });

    it('should reject label creation attempts: only existing labels survive', () => {
      // An injection might ask the AI to "create" a new label.
      // Since policy only allows existing repo labels, this fails.
      const result = service.validate(
        makeOutput({
          suggestedLabels: ['urgent-fix', 'new-custom-label', 'bug'],
        }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.allowedLabels).toEqual(['bug']);
      expect(result.rejectedLabels).toHaveLength(2);
    });

    it('should reject forbidden labels when allowlist is configured', () => {
      // Even if labels exist in the repo, the allowlist further restricts.
      const config = {
        labelAllowlist: ['bug', 'ruan:needs-info'],
        maxLabels: 5,
      };

      const result = service.validate(
        makeOutput({
          suggestedLabels: ['bug', 'enhancement', 'documentation', 'wontfix'],
        }),
        REPO_LABELS,
        config,
      );

      expect(result.allowedLabels).toEqual(['bug']);
      expect(result.rejectedLabels).toHaveLength(3);
    });

    it('should not allow injection to bypass maximum label limit', () => {
      const config = { labelAllowlist: null, maxLabels: 2 };

      const result = service.validate(
        makeOutput({
          suggestedLabels: [
            'bug',
            'enhancement',
            'documentation',
            'question',
            'help wanted',
          ],
        }),
        REPO_LABELS,
        config,
      );

      expect(result.allowedLabels).toHaveLength(2);
    });

    it('should reject unsafe comment body from injection', () => {
      const result = service.validate(
        makeOutput({
          commentBody:
            'Here is the triage <script>document.cookie</script> result.',
        }),
        REPO_LABELS,
        DEFAULT_CONFIG,
      );

      expect(result.commentAllowed).toBe(false);
    });
  });

  describe('validatePlan', () => {
    it('should allow valid plan comments', () => {
      const plan = {
        workflow: 'plan' as const,
        problemStatement: 'Integrate Milestone 3 features.',
        scope: ['implement plan workflow'],
        nonScope: [],
        dependencies: [],
        taskSequence: ['1. Setup interface files'],
        acceptanceCriteria: ['all tests pass'],
        verificationStrategy: 'Run npm run test.',
        humanDecisions: [],
        commentBody: 'Proposed plan body with enough characters.',
        confidence: 'high' as const,
        assumptions: [],
        evidence: [],
      };
      const result = service.validatePlan(plan);
      expect(result.valid).toBe(true);
      expect(result.commentAllowed).toBe(true);
    });

    it('should reject short plan comments', () => {
      const plan = {
        workflow: 'plan' as const,
        problemStatement: 'Integrate Milestone 3 features.',
        scope: ['implement plan workflow'],
        nonScope: [],
        dependencies: [],
        taskSequence: ['1. Setup interface files'],
        acceptanceCriteria: ['all tests pass'],
        verificationStrategy: 'Run npm run test.',
        humanDecisions: [],
        commentBody: 'Short',
        confidence: 'high' as const,
        assumptions: [],
        evidence: [],
      };
      const result = service.validatePlan(plan);
      expect(result.valid).toBe(false);
      expect(result.commentAllowed).toBe(false);
    });
  });

  describe('validateSplit', () => {
    const validSplit = {
      workflow: 'split' as const,
      tasks: [
        {
          id: 'task-1',
          title: 'Implement component A',
          objective: 'Build A independently',
          filesToInspect: ['src/components/a.ts'],
          allowedOperations: ['create', 'edit'],
          dependencies: [],
          parallelizationGuidance: 'Can run in parallel with task-2.',
          verificationCommands: ['npm run test'],
          completionEvidence: 'Tests pass.',
          ownerType: 'coding_agent' as const,
        },
      ],
      commentBody: 'Proposed split comment body with enough characters.',
      confidence: 'high' as const,
      assumptions: [],
      evidence: [],
    };

    it('should allow valid split output when active plan is present', () => {
      const result = service.validateSplit(validSplit, true);
      expect(result.valid).toBe(true);
      expect(result.commentAllowed).toBe(true);
    });

    it('should reject split output when no active plan is present', () => {
      const result = service.validateSplit(validSplit, false);
      expect(result.valid).toBe(false);
      expect(result.commentRejectionReason).toContain('without an active plan');
    });

    it('should reject split output when task requests unauthorized mutation', () => {
      const unauthorizedSplit = {
        ...validSplit,
        tasks: [
          {
            ...validSplit.tasks[0],
            allowedOperations: ['admin', 'create'],
          },
        ],
      };
      const result = service.validateSplit(unauthorizedSplit, true);
      expect(result.valid).toBe(false);
      expect(result.commentRejectionReason).toContain(
        'unauthorized operations',
      );
      expect(
        result.warnings.some((w) =>
          w.includes('unauthorized repository mutation'),
        ),
      ).toBe(true);
    });

    it('should reject delete as an unsafe split operation', () => {
      const unsafeDeleteSplit = {
        ...validSplit,
        tasks: [
          {
            ...validSplit.tasks[0],
            allowedOperations: ['delete'],
          },
        ],
      };

      const result = service.validateSplit(unsafeDeleteSplit, true);

      expect(result.valid).toBe(false);
      expect(result.commentRejectionReason).toContain(
        'unauthorized operations',
      );
    });
  });
});
