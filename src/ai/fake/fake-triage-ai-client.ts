import { Injectable, Logger, Optional } from '@nestjs/common';
import { AiClient } from '../interfaces/ai-client.interface';
import { TriageOutput } from '../interfaces/triage-output.interface';
import { IssueTriageContext } from '../../context/interfaces/issue-triage-context.interface';
import { IssuePlanContext } from '../../context/interfaces/issue-plan-context.interface';
import { PlanOutput } from '../interfaces/plan-output.interface';
import { IssueSplitContext } from '../../context/interfaces/issue-split-context.interface';
import {
  SplitOutput,
  CodingAgentTask,
} from '../interfaces/split-output.interface';
import { IssueStatusContext } from '../../context/interfaces/issue-status-context.interface';
import { StatusOutput } from '../interfaces/status-output.interface';
import { IssueBlockerContext } from '../../context/interfaces/issue-blocker-context.interface';
import { BlockerOutput } from '../interfaces/blocker-output.interface';
import { TelemetryService } from '../../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../../telemetry/services/rate-limit-tracker.service';

/**
 * Deterministic fake AI client for tests and local development.
 *
 * Returns structured triage output based on keyword matching in the issue title:
 * - Title contains "bug": labels: ["bug"], riskLevel: "medium"
 * - Title contains "feature": labels: ["enhancement"], riskLevel: "low"
 * - Title contains "security" or "vulnerability": labels: ["bug"], riskLevel: "high"
 * - Default: labels: ["ruan:needs-info"], riskLevel: "low"
 *
 * Suggested labels are filtered to only include labels that exist in repositoryLabels,
 * matching the real client's expected behavior.
 */
@Injectable()
export class FakeTriageAiClient extends AiClient {
  private readonly logger = new Logger(FakeTriageAiClient.name);

  constructor(
    @Optional() private readonly telemetryService?: TelemetryService,
    @Optional() private readonly rateLimitTracker?: RateLimitTrackerService,
  ) {
    super();
  }

  private recordModelCall(workflow: string) {
    if (this.rateLimitTracker) {
      this.rateLimitTracker.recordAiRequest(100); // Fake token estimate
    }
    if (this.telemetryService) {
      this.telemetryService.recordEvent({
        type: 'model_call',
        severity: 'info',
        message: `AI Model called for workflow: ${workflow}`,
        metadata: { workflow },
      });
    }
  }

  async triage(context: IssueTriageContext): Promise<TriageOutput> {
    await Promise.resolve();
    this.recordModelCall('triage');
    this.logger.log(
      `[FAKE AI] Triaging issue #${context.issue.number}: ${context.issue.title}`,
    );

    const title = context.issue.title.toLowerCase();
    const repoLabelNames = new Set(context.repositoryLabels.map((l) => l.name));

    let suggestedLabels: string[];
    let riskLevel: 'low' | 'medium' | 'high';
    let summary: string;

    if (title.includes('security') || title.includes('vulnerability')) {
      suggestedLabels = ['bug'];
      riskLevel = 'high';
      summary = 'Security-related issue requiring immediate attention.';
    } else if (title.includes('bug')) {
      suggestedLabels = ['bug'];
      riskLevel = 'medium';
      summary = 'Bug report requiring investigation.';
    } else if (title.includes('feature')) {
      suggestedLabels = ['enhancement'];
      riskLevel = 'low';
      summary = 'Feature request for evaluation.';
    } else {
      suggestedLabels = ['ruan:needs-info'];
      riskLevel = 'low';
      summary = 'Issue requires further classification and information.';
    }

    const missingInformation: string[] = [];
    const missingTemplateFields =
      context.templateFields?.filter((field) => field.missing) ?? [];

    for (const field of missingTemplateFields) {
      missingInformation.push(
        `${field.name} is missing - ${this.describeTemplateFieldNeed(field.name)}`,
      );
    }

    if (!context.issue.body || context.issue.body.trim().length < 20) {
      missingInformation.push(
        'Issue body is too short - please provide more details about the problem or request.',
      );
    }

    if (missingInformation.length > 0) {
      suggestedLabels.push('ruan:needs-info');
    }

    // Only suggest labels that actually exist in the repository.
    suggestedLabels = [...new Set(suggestedLabels)].filter((l) =>
      repoLabelNames.has(l),
    );

    const commentBody = this.buildCommentBody(
      summary,
      riskLevel,
      suggestedLabels,
      missingInformation,
    );

    return {
      workflow: 'triage',
      summary,
      riskLevel,
      suggestedLabels,
      missingInformation,
      recommendedNextCommand:
        missingInformation.length > 0 ? 'human_clarification' : '/plan',
      commentBody,
      confidence: riskLevel === 'high' ? 'medium' : 'high',
      assumptions: [],
      evidence: [
        {
          source: 'issue_title',
          content: context.issue.title,
        },
        ...missingTemplateFields.map((field) => ({
          source: `issue_template_field:${field.name}`,
          content: field.value,
        })),
      ],
    };
  }

  private describeTemplateFieldNeed(fieldName: string): string {
    const normalized = fieldName.toLowerCase();
    if (normalized.includes('expected')) {
      return 'describe what should happen.';
    }
    if (normalized.includes('actual')) {
      return 'describe what happened instead.';
    }
    if (normalized.includes('reproduction') || normalized.includes('steps')) {
      return 'provide concrete steps to reproduce.';
    }
    if (normalized.includes('acceptance')) {
      return 'list the acceptance criteria.';
    }
    return 'provide a concrete answer for this template field.';
  }

  private buildCommentBody(
    summary: string,
    riskLevel: string,
    labels: string[],
    missingInfo: string[],
  ): string {
    const lines: string[] = [];
    lines.push(`## Triage Summary\n`);
    lines.push(summary);
    lines.push(`\n**Risk Level:** ${riskLevel}`);

    if (labels.length > 0) {
      lines.push(
        `\n**Suggested Labels:** ${labels.map((l) => '`' + l + '`').join(', ')}`,
      );
    }

    if (missingInfo.length > 0) {
      lines.push(`\n### Missing Information\n`);
      for (const info of missingInfo) {
        lines.push(`- ${info}`);
      }
    }

    return lines.join('\n');
  }

  private repairBehavior?: (
    validationErrors: string[],
    contextSummary: string,
    targetWorkflow: string,
  ) => any;

  setRepairBehavior(
    fn: (
      validationErrors: string[],
      contextSummary: string,
      targetWorkflow: string,
    ) => any,
  ) {
    this.repairBehavior = fn;
  }

  async plan(context: IssuePlanContext): Promise<PlanOutput> {
    await Promise.resolve();
    this.recordModelCall('plan');
    this.logger.log(
      `[FAKE AI] Planning for issue #${context.issue.number}: ${context.issue.title}`,
    );

    const isUnderspecified =
      context.issue.body.toLowerCase().includes('underspecified') ||
      context.issue.body.toLowerCase().includes('vague') ||
      context.issue.body.length < 20;

    const problemStatement = `Implement the requested workflow change for: ${context.issue.title}`;
    const scope = isUnderspecified
      ? []
      : [
          'Update workflow context builders and AI behavior for the requested issue.',
          'Add focused tests for the new planning behavior.',
          'Update controlling docs when behavior changes.',
        ];
    const nonScope = isUnderspecified
      ? []
      : [
          'Production deployment or release tagging',
          'New GitHub permissions or persistence unless explicitly required',
          'Direct coding-agent execution',
        ];
    const dependencies = isUnderspecified
      ? []
      : [
          'Read controlling design and workflow docs before implementation.',
          'Preserve GitHub write policy and schema validation boundaries.',
        ];
    const taskSequence = isUnderspecified
      ? []
      : [
          '1. Inspect relevant workflow/context/schema files and existing tests.',
          '2. Add failing tests for the requested behavior.',
          '3. Implement narrowly scoped code changes behind existing service boundaries.',
          '4. Update design documentation if workflow context or output behavior changes.',
          '5. Run build, lint, unit, and e2e verification.',
        ];
    const acceptanceCriteria = isUnderspecified
      ? []
      : [
          'Output asks actionable questions when required details are missing.',
          'GitHub-facing comments remain policy-compatible and evidence-based.',
          'Focused tests cover the new behavior and full verification passes.',
        ];
    const verificationStrategy = [
      "$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build",
      '$env:GITHUB_WEBHOOK_SECRET=\'test-secret\'; npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings=0',
      "$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand",
      "$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e",
    ].join('\n');
    const humanDecisions = isUnderspecified
      ? [
          'What is the detailed requirement scope?',
          'Which edge cases must be handled?',
        ]
      : [];

    const commentLines = [
      `## Proposed Plan for #${context.issue.number}`,
      `**Problem Statement:** ${problemStatement}`,
      `**Confidence:** ${isUnderspecified ? 'low' : 'high'}`,
    ];

    if (isUnderspecified) {
      commentLines.push('\n### Direct Human Decisions Required');
      for (const q of humanDecisions) {
        commentLines.push(`- ${q}`);
      }
    } else {
      commentLines.push('\n### Scope');
      for (const s of scope) {
        commentLines.push(`- ${s}`);
      }
      commentLines.push('\n### Non-Scope');
      for (const item of nonScope) {
        commentLines.push(`- ${item}`);
      }
      commentLines.push('\n### Dependencies');
      for (const dependency of dependencies) {
        commentLines.push(`- ${dependency}`);
      }
      commentLines.push('\n### Task Sequence');
      for (const t of taskSequence) {
        commentLines.push(`- ${t}`);
      }
      commentLines.push('\n### Acceptance Criteria');
      for (const criterion of acceptanceCriteria) {
        commentLines.push(`- ${criterion}`);
      }
      commentLines.push('\n### Verification');
      commentLines.push(verificationStrategy);
    }

    const evidence = [
      {
        source: 'issue_title',
        content: context.issue.title,
      },
    ];
    if (context.priorTriageComment) {
      evidence.push({
        source: 'prior_triage_comment',
        content: context.priorTriageComment,
      });
    }

    return {
      workflow: 'plan',
      problemStatement,
      scope,
      nonScope,
      dependencies,
      taskSequence,
      acceptanceCriteria,
      verificationStrategy,
      humanDecisions,
      commentBody: commentLines.join('\n'),
      confidence: isUnderspecified ? 'low' : 'high',
      assumptions: ['No prior plan exists'],
      evidence,
    };
  }

  async split(context: IssueSplitContext): Promise<SplitOutput> {
    await Promise.resolve();
    this.recordModelCall('split');
    this.logger.log(
      `[FAKE AI] Splitting tasks for issue #${context.issue.number}: ${context.issue.title}`,
    );

    const titleLower = context.issue.title.toLowerCase();
    const isBlocked = titleLower.includes('blocked');
    const isHuman = titleLower.includes('human');
    const isParallel = titleLower.includes('parallel');

    const tasks: CodingAgentTask[] = [];

    if (isBlocked) {
      tasks.push({
        id: 'task-1',
        title: 'Blocked dependency setup',
        objective: 'Wait for third-party library configuration',
        filesToInspect: [],
        allowedOperations: [],
        dependencies: [],
        parallelizationGuidance: 'Blocked; cannot parallelize.',
        verificationCommands: [],
        completionEvidence: 'Config file is provided.',
        ownerType: 'blocked',
      });
    } else if (isHuman) {
      tasks.push({
        id: 'task-1',
        title: 'Review database credentials',
        objective: 'Manually verify database access',
        filesToInspect: ['config/database.json'],
        allowedOperations: ['view'],
        dependencies: [],
        parallelizationGuidance: 'Requires human credentials validation.',
        verificationCommands: [],
        completionEvidence: 'Verification email sent.',
        ownerType: 'human',
      });
    } else if (isParallel) {
      // Parallel tasks
      tasks.push(
        {
          id: 'task-1',
          title: 'Implement component A',
          objective: 'Build A independently',
          filesToInspect: ['src/components/a.ts'],
          allowedOperations: ['create'],
          dependencies: [],
          parallelizationGuidance: 'Can run in parallel with task-2.',
          verificationCommands: ['npm run test'],
          completionEvidence: 'Tests pass.',
          ownerType: 'coding_agent',
        },
        {
          id: 'task-2',
          title: 'Implement component B',
          objective: 'Build B independently',
          filesToInspect: ['src/components/b.ts'],
          allowedOperations: ['create'],
          dependencies: [],
          parallelizationGuidance: 'Can run in parallel with task-1.',
          verificationCommands: ['npm run test'],
          completionEvidence: 'Tests pass.',
          ownerType: 'coding_agent',
        },
      );
    } else {
      tasks.push(
        {
          id: 'task-1',
          title: 'Inspect workflow surface',
          objective:
            'Read the active plan and inspect the workflow, context, schema, and policy files that control the requested behavior.',
          filesToInspect: [
            'src/pm-workflow/services/',
            'src/context/builders/',
            'src/context/interfaces/',
            'src/ai/interfaces/',
            'src/ai/schemas/',
            'src/policy/services/',
          ],
          allowedOperations: ['read', 'inspect'],
          dependencies: [],
          parallelizationGuidance:
            'Run before implementation tasks because it defines the exact files and constraints.',
          verificationCommands: ['npx jest --listTests'],
          completionEvidence:
            'Notes identify the exact files and tests that need edits.',
          ownerType: 'coding_agent',
        },
        {
          id: 'task-2',
          title: 'Implement focused workflow behavior',
          objective:
            'Add failing tests first, then implement the scoped workflow/context/AI behavior from the active plan.',
          filesToInspect: [
            'src/ai/fake/fake-triage-ai-client.ts',
            'src/ai/fake/fake-triage-ai-client.spec.ts',
            'src/context/builders/',
            'src/context/interfaces/',
          ],
          allowedOperations: ['create', 'edit', 'read'],
          dependencies: ['task-1'],
          parallelizationGuidance:
            'Serialized after task-1 because it may edit the same workflow and context surfaces.',
          verificationCommands: [
            "$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest src/ai/fake/fake-triage-ai-client.spec.ts --runInBand",
          ],
          completionEvidence:
            'Focused tests fail before implementation and pass after implementation.',
          ownerType: 'coding_agent',
        },
        {
          id: 'task-3',
          title: 'Verify and document handoff',
          objective:
            'Run verification commands and update docs if the workflow contract or context strategy changed.',
          filesToInspect: [
            'docs/design/03-github-app-workflows.md',
            'docs/design/05-ai-orchestration.md',
            'docs/operations/github-workflow.md',
          ],
          allowedOperations: ['read'],
          dependencies: ['task-2'],
          parallelizationGuidance:
            'Serialized after implementation so verification evidence matches the final diff.',
          verificationCommands: [
            "$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run build",
            '$env:GITHUB_WEBHOOK_SECRET=\'test-secret\'; npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings=0',
            "$env:GITHUB_WEBHOOK_SECRET='test-secret'; npx jest --runInBand",
            "$env:GITHUB_WEBHOOK_SECRET='test-secret'; npm run test:e2e",
          ],
          completionEvidence:
            'Build, lint, unit, and e2e verification output is captured in the PR or issue comment.',
          ownerType: 'coding_agent',
        },
      );
    }

    const commentLines = [
      `## Proposed Coding-Agent Task Split for #${context.issue.number}`,
      `Total tasks proposed: ${tasks.length}`,
    ];

    for (const t of tasks) {
      commentLines.push(`\n### Task: ${t.title} (${t.id})`);
      commentLines.push(`- **Objective:** ${t.objective}`);
      commentLines.push(`- **Owner Type:** ${t.ownerType}`);
      if (t.dependencies.length > 0) {
        commentLines.push(`- **Dependencies:** ${t.dependencies.join(', ')}`);
      }
      commentLines.push(
        `- **Files to Inspect:** ${t.filesToInspect.join(', ') || 'None'}`,
      );
      commentLines.push(
        `- **Allowed Operations:** ${t.allowedOperations.join(', ') || 'None'}`,
      );
      commentLines.push(
        `- **Verification:** ${t.verificationCommands.join('; ') || 'None'}`,
      );
      commentLines.push(`- **Completion Evidence:** ${t.completionEvidence}`);
      commentLines.push(
        `- **Parallelization Guidance:** ${t.parallelizationGuidance}`,
      );
    }

    return {
      workflow: 'split',
      tasks,
      commentBody: commentLines.join('\n'),
      confidence: 'high',
      assumptions: [],
      evidence: context.activePlanComment
        ? [
            {
              source: 'active_plan_comment',
              content: context.activePlanComment,
            },
          ]
        : [],
    };
  }

  async status(context: IssueStatusContext): Promise<StatusOutput> {
    await Promise.resolve();
    this.recordModelCall('status');
    this.logger.log(
      `[FAKE AI] Getting status for issue #${context.issue.number}: ${context.issue.title}`,
    );

    const isBlocked = context.issue.title.toLowerCase().includes('blocked');
    const failingCheck = context.checkRuns.find(
      (run) =>
        run.status === 'completed' &&
        run.conclusion !== null &&
        run.conclusion !== undefined &&
        run.conclusion !== 'success' &&
        run.conclusion !== 'skipped',
    );
    const openPullRequest = context.linkedPullRequests.find(
      (pullRequest) => pullRequest.state === 'open',
    );

    const state = isBlocked || failingCheck ? 'blocked' : 'in_progress';
    const completedWork =
      context.linkedPullRequests.length > 0
        ? ['Opened linked PR']
        : ['Setup repo'];
    const openTasks = openPullRequest
      ? [`Review or merge PR #${openPullRequest.number}`]
      : ['Finish feature'];
    const blockers = [
      ...(isBlocked ? ['Missing API keys'] : []),
      ...(failingCheck
        ? [
            `PR #${failingCheck.pullRequestNumber} has failing check: ${failingCheck.name}`,
          ]
        : []),
    ];
    const nextAction = failingCheck
      ? `Fix failing checks on PR #${failingCheck.pullRequestNumber}`
      : isBlocked
        ? 'Wait for keys'
        : openPullRequest
          ? `Review PR #${openPullRequest.number}`
          : 'Code feature';

    const commentLines = [
      `## Current Status for #${context.issue.number}`,
      `**State:** ${state}`,
      `**Next Action:** ${nextAction}`,
    ];

    return {
      workflow: 'status',
      state,
      completedWork,
      openTasks,
      blockers,
      nextAction,
      commentBody: commentLines.join('\n'),
      confidence: 'high',
      assumptions: [],
      evidence: [
        {
          source: 'issue_title',
          content: context.issue.title,
          type: 'observed',
        },
        ...context.linkedPullRequests.map((pullRequest) => ({
          source: `pull_request:${pullRequest.number}`,
          content: `${pullRequest.state} PR ${pullRequest.url}`,
          type: 'observed' as const,
        })),
        ...context.checkRuns.map((run) => ({
          source: `check_run:${run.name}`,
          content: `PR #${run.pullRequestNumber} check ${run.name}: ${run.status}/${run.conclusion ?? 'none'}`,
          type: 'observed' as const,
        })),
      ],
    };
  }

  async blocker(context: IssueBlockerContext): Promise<BlockerOutput> {
    await Promise.resolve();
    this.recordModelCall('blocker');
    this.logger.log(
      `[FAKE AI] Analyzing blocker for issue #${context.issue.number}: ${context.issue.title}`,
    );

    const failingDeploymentSignal = context.deploymentSignals.find(
      (signal) =>
        signal.status !== 'success' &&
        signal.status !== 'neutral' &&
        signal.status !== 'skipped',
    );
    const failingCheck = context.checkRuns.find(
      (run) =>
        run.status === 'completed' &&
        run.conclusion !== null &&
        run.conclusion !== undefined &&
        run.conclusion !== 'success' &&
        run.conclusion !== 'skipped',
    );
    const hasEvidence =
      context.blockerTriggeringText.toLowerCase().includes('evidence') ||
      Boolean(failingDeploymentSignal) ||
      Boolean(failingCheck);

    const summary = failingDeploymentSignal
      ? `Deployment blocker observed from ${failingDeploymentSignal.source}`
      : 'Analysis of reported blocker';
    const likelyCause = failingDeploymentSignal
      ? 'Deployment signal is failing'
      : failingCheck
        ? `Check ${failingCheck.name} is failing`
        : hasEvidence
          ? 'API is down'
          : null;
    const nextProvingMethod = failingDeploymentSignal
      ? `Inspect ${failingDeploymentSignal.source} and fix the failing deployment step`
      : failingCheck
        ? `Inspect check_run:${failingCheck.name} and fix the failing check`
        : 'Check API status page';
    const directHumanQuestions = hasEvidence ? [] : ['Did you check the API?'];

    const commentLines = [
      `## Blocker Analysis for #${context.issue.number}`,
      `**Summary:** ${summary}`,
    ];

    if (likelyCause) {
      commentLines.push(`**Likely Cause:** ${likelyCause}`);
    }

    return {
      workflow: 'blocker',
      summary,
      likelyCause,
      nextProvingMethod,
      directHumanQuestions,
      commentBody: commentLines.join('\n'),
      confidence: hasEvidence ? 'high' : 'low',
      assumptions: [],
      evidence: [
        ...context.deploymentSignals.map((signal) => ({
          source: signal.source,
          content: signal.summary,
          type: 'observed' as const,
        })),
        ...context.checkRuns.map((run) => ({
          source: `check_run:${run.name}`,
          content: `PR #${run.pullRequestNumber} check ${run.name}: ${run.status}/${run.conclusion ?? 'none'}`,
          type: 'observed' as const,
        })),
        {
          source: 'triggering_comment',
          content: context.blockerTriggeringText,
          type: 'observed',
        },
      ],
    };
  }

  async repair(
    validationErrors: string[],
    contextSummary: string,
    targetWorkflow: string,
  ): Promise<any> {
    await Promise.resolve();
    if (this.repairBehavior) {
      return this.repairBehavior(
        validationErrors,
        contextSummary,
        targetWorkflow,
      );
    }

    if (targetWorkflow === 'plan') {
      return {
        workflow: 'plan',
        problemStatement: 'Repaired problem statement.',
        scope: ['repaired'],
        nonScope: [],
        dependencies: [],
        taskSequence: ['repaired task'],
        acceptanceCriteria: [],
        verificationStrategy: 'Repaired verification strategy.',
        humanDecisions: [],
        commentBody: 'Repaired plan.',
        confidence: 'high',
        assumptions: [],
        evidence: [],
      };
    } else if (targetWorkflow === 'status') {
      return {
        workflow: 'status',
        state: 'in_progress',
        completedWork: [],
        openTasks: [],
        blockers: [],
        nextAction: 'Repaired action',
        commentBody: 'Repaired status.',
        confidence: 'high',
        assumptions: [],
        evidence: [],
      };
    } else if (targetWorkflow === 'blocker') {
      return {
        workflow: 'blocker',
        summary: 'Repaired blocker summary',
        likelyCause: null,
        nextProvingMethod: 'Repaired method',
        directHumanQuestions: [],
        commentBody: 'Repaired blocker.',
        confidence: 'high',
        assumptions: [],
        evidence: [],
      };
    } else if (targetWorkflow === 'triage') {
      return {
        workflow: 'triage',
        summary: 'Repaired triage summary',
        riskLevel: 'low',
        suggestedLabels: [],
        missingInformation: [],
        recommendedNextCommand: '/plan',
        commentBody: 'Repaired triage.',
        confidence: 'high',
        assumptions: [],
        evidence: [],
      };
    } else {
      return {
        workflow: 'split',
        tasks: [
          {
            id: 'task-1',
            title: 'Repaired task',
            objective: 'Repaired objective',
            filesToInspect: [],
            allowedOperations: [],
            dependencies: [],
            parallelizationGuidance: '',
            verificationCommands: [],
            completionEvidence: '',
            ownerType: 'coding_agent',
          },
        ],
        commentBody: 'Repaired split.',
        confidence: 'high',
        assumptions: [],
        evidence: [],
      };
    }
  }

  async checkModel(modelId: string): Promise<boolean> {
    await Promise.resolve();
    return !modelId.startsWith('unavailable');
  }
}
