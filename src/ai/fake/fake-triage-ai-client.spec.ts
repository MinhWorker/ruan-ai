import { Test, TestingModule } from '@nestjs/testing';
import { FakeTriageAiClient } from './fake-triage-ai-client';
import { TelemetryService } from '../../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../../telemetry/services/rate-limit-tracker.service';
import { IssueTriageContext } from '../../context/interfaces/issue-triage-context.interface';
import { IssueStatusContext } from '../../context/interfaces/issue-status-context.interface';
import { IssueBlockerContext } from '../../context/interfaces/issue-blocker-context.interface';
import { IssuePlanContext } from '../../context/interfaces/issue-plan-context.interface';
import { IssueSplitContext } from '../../context/interfaces/issue-split-context.interface';

describe('FakeTriageAiClient', () => {
  let client: FakeTriageAiClient;
  let telemetryService: jest.Mocked<TelemetryService>;
  let rateLimitTracker: jest.Mocked<RateLimitTrackerService>;

  beforeEach(async () => {
    telemetryService = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<TelemetryService>;

    rateLimitTracker = {
      recordAiRequest: jest.fn(),
    } as unknown as jest.Mocked<RateLimitTrackerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FakeTriageAiClient,
        { provide: TelemetryService, useValue: telemetryService },
        { provide: RateLimitTrackerService, useValue: rateLimitTracker },
      ],
    }).compile();

    client = module.get<FakeTriageAiClient>(FakeTriageAiClient);
  });

  it('should run triage without credentials and record telemetry', async () => {
    const context = {
      issue: { number: 1, title: 'bug', body: 'This is a test bug report.' },
      repositoryLabels: [{ name: 'bug', color: 'ff0000' }],
    } as IssueTriageContext;

    const result = await client.triage(context);
    expect(result.workflow).toBe('triage');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(jest.mocked(telemetryService.recordEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'model_call',
        metadata: { workflow: 'triage' },
      }),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(jest.mocked(rateLimitTracker.recordAiRequest)).toHaveBeenCalledWith(
      100,
    );
  });

  it('should report blocked status when linked pull request checks fail', async () => {
    const context: IssueStatusContext = {
      issue: {
        number: 1,
        title: 'Implement feature',
        body: 'Feature work',
        author: 'user',
        createdAt: '2026-01-01T00:00:00Z',
        labels: [],
      },
      repositoryLabels: [],
      recentComments: [],
      appComments: [],
      scheduledFollowUps: [],
      linkedPullRequests: [
        {
          number: 42,
          title: 'Implement feature',
          state: 'open',
          author: 'dev',
          url: 'https://github.com/test/repo/pull/42',
          headRefName: 'feature',
          headSha: 'abc123',
          baseRefName: 'develop',
          draft: false,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T01:00:00Z',
        },
      ],
      checkRuns: [
        {
          pullRequestNumber: 42,
          ref: 'abc123',
          name: 'unit-tests',
          status: 'completed',
          conclusion: 'failure',
        },
      ],
      relatedIssues: [],
      unavailableContextSources: [],
    };

    const result = await client.status(context);

    expect(result.state).toBe('blocked');
    expect(result.blockers).toContain('PR #42 has failing check: unit-tests');
    expect(result.nextAction).toBe('Fix failing checks on PR #42');
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'check_run:unit-tests',
          type: 'observed',
        }),
      ]),
    );
  });

  it('should ground blocker analysis in deployment evidence when available', async () => {
    const context: IssueBlockerContext = {
      issue: {
        number: 1,
        title: 'Staging deploy blocked',
        body: 'Deploy is failing',
        author: 'user',
        createdAt: '2026-01-01T00:00:00Z',
        labels: [],
      },
      recentComments: [],
      blockerTriggeringText: '@ruangm-ai /blocker staging deploy failed',
      linkedPullRequests: [],
      checkRuns: [
        {
          pullRequestNumber: 42,
          ref: 'abc123',
          name: 'Cloud Build staging',
          status: 'completed',
          conclusion: 'failure',
          detailsUrl: 'https://console.cloud.google.com/cloud-build/builds/1',
        },
      ],
      relatedIssues: [],
      deploymentSignals: [
        {
          source: 'check_run:Cloud Build staging',
          status: 'failure',
          summary:
            'PR #42 deployment signal Cloud Build staging: completed/failure',
          url: 'https://console.cloud.google.com/cloud-build/builds/1',
        },
      ],
      unavailableContextSources: [],
    };

    const result = await client.blocker(context);

    expect(result.likelyCause).toBe('Deployment signal is failing');
    expect(result.nextProvingMethod).toBe(
      'Inspect check_run:Cloud Build staging and fix the failing deployment step',
    );
    expect(result.directHumanQuestions).toEqual([]);
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'check_run:Cloud Build staging',
          type: 'observed',
        }),
      ]),
    );
  });

  it('should ask actionable clarification for missing issue template fields', async () => {
    const context = {
      issue: {
        number: 18,
        title: 'Bug: app crashes on startup',
        body: '### Expected behavior\n\n_No response_\n\n### Actual behavior\n\nIt crashes.',
      },
      repositoryLabels: [
        { name: 'bug', description: 'Bug', color: 'ff0000' },
        {
          name: 'ruan:needs-info',
          description: 'Missing information required',
          color: 'fbca04',
        },
      ],
      templateFields: [
        {
          name: 'Expected behavior',
          value: '_No response_',
          missing: true,
        },
      ],
    } as IssueTriageContext;

    const result = await client.triage(context);

    expect(result.recommendedNextCommand).toBe('human_clarification');
    expect(result.suggestedLabels).toEqual(['bug', 'ruan:needs-info']);
    expect(result.missingInformation).toContain(
      'Expected behavior is missing - describe what should happen.',
    );
    expect(result.commentBody).toContain('Expected behavior');
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        {
          source: 'issue_template_field:Expected behavior',
          content: '_No response_',
        },
      ]),
    );
  });

  it('should produce implementation-ready plan details for sufficiently specified issues', async () => {
    const context = {
      issue: {
        number: 19,
        title: 'Improve triage clarification flow',
        body: [
          'Implement template-aware triage.',
          'Scope: update context builders, fake AI behavior, policy-compatible comments, and tests.',
          'Acceptance criteria: missing template fields produce actionable questions.',
          'Verification: npm run build, npx jest --runInBand, npm run test:e2e.',
        ].join('\n'),
      },
      priorTriageComment:
        '<!-- ruan-ai:workflow=triage issue=19 logical=triage-result version=1 --> needs implementation plan',
      recentComments: [],
      repositoryLabels: [],
      currentIssueLabels: [],
    } as IssuePlanContext;

    const result = await client.plan(context);

    expect(result.humanDecisions).toEqual([]);
    expect(result.scope).toEqual(
      expect.arrayContaining([
        'Update workflow context builders and AI behavior for the requested issue.',
        'Add focused tests for the new planning behavior.',
      ]),
    );
    expect(result.nonScope).toContain(
      'Production deployment or release tagging',
    );
    expect(result.dependencies).toContain(
      'Read controlling design and workflow docs before implementation.',
    );
    expect(result.taskSequence).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Inspect relevant workflow/context/schema files',
        ),
        expect.stringContaining('Implement narrowly scoped code changes'),
      ]),
    );
    expect(result.acceptanceCriteria).toEqual(
      expect.arrayContaining([
        expect.stringContaining('actionable questions'),
        expect.stringContaining('policy-compatible'),
      ]),
    );
    expect(result.verificationStrategy).toContain('npm run build');
    expect(result.verificationStrategy).toContain('npx jest --runInBand');
    expect(result.commentBody).toContain('### Non-Scope');
    expect(result.commentBody).toContain('### Acceptance Criteria');
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        {
          source: 'prior_triage_comment',
          content:
            '<!-- ruan-ai:workflow=triage issue=19 logical=triage-result version=1 --> needs implementation plan',
        },
      ]),
    );
  });

  it('should generate safe handoff packets from an active implementation plan', async () => {
    const context = {
      issue: {
        number: 17,
        title: 'Make split generate safe agent handoff tasks',
        body: 'Split the implementation plan into safe agent tasks.',
      },
      activePlanComment: [
        '<!-- ruan-ai:workflow=plan issue=17 logical=active-plan version=1 -->',
        '### Task Sequence',
        '- 1. Inspect relevant workflow/context/schema files and existing tests.',
        '- 2. Add failing tests for the requested behavior.',
        '- 3. Implement narrowly scoped code changes behind existing service boundaries.',
        '- 4. Run build, lint, unit, and e2e verification.',
      ].join('\n'),
      recentComments: [],
      repositoryLabels: [],
      currentIssueLabels: [],
    } as IssueSplitContext;

    const result = await client.split(context);

    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0]).toEqual(
      expect.objectContaining({
        id: 'task-1',
        ownerType: 'coding_agent',
        allowedOperations: ['read', 'inspect'],
        dependencies: [],
      }),
    );
    expect(result.tasks[1]).toEqual(
      expect.objectContaining({
        id: 'task-2',
        allowedOperations: ['create', 'edit', 'read'],
        dependencies: ['task-1'],
      }),
    );
    expect(result.tasks[2]).toEqual(
      expect.objectContaining({
        id: 'task-3',
        allowedOperations: ['read'],
        dependencies: ['task-2'],
      }),
    );
    for (const task of result.tasks) {
      expect(task.filesToInspect.length).toBeGreaterThan(0);
      expect(task.verificationCommands.length).toBeGreaterThan(0);
      expect(task.completionEvidence).not.toBe('');
      expect(task.parallelizationGuidance).not.toBe('');
    }
    expect(result.commentBody).toContain('Allowed Operations');
    expect(result.commentBody).toContain('Verification');
    expect(result.commentBody).toContain('Completion Evidence');
    expect(result.evidence).toEqual([
      {
        source: 'active_plan_comment',
        content: context.activePlanComment,
      },
    ]);
  });
});
