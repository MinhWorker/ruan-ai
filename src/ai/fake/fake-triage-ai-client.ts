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

    // Only suggest labels that actually exist in the repository
    suggestedLabels = suggestedLabels.filter((l) => repoLabelNames.has(l));

    const missingInformation: string[] = [];
    if (!context.issue.body || context.issue.body.trim().length < 20) {
      missingInformation.push(
        'Issue body is too short - please provide more details about the problem or request.',
      );
    }

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
      ],
    };
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

    const problemStatement = `Execute planning workflow for: ${context.issue.title}`;
    const scope = isUnderspecified
      ? []
      : ['Implement milestone features', 'Add unit and integration tests'];
    const nonScope = isUnderspecified ? [] : ['Deploy code to production'];
    const dependencies = isUnderspecified
      ? []
      : ['Milestone 2 triage baseline'];
    const taskSequence = isUnderspecified
      ? []
      : [
          '1. Setup interface files',
          '2. Implement service logic',
          '3. Run verification tests',
        ];
    const acceptanceCriteria = isUnderspecified
      ? []
      : ['All unit tests pass', 'Linting succeeds'];
    const verificationStrategy = 'Run local test commands defined in roadmap.';
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
      commentLines.push('\n### Task Sequence');
      for (const t of taskSequence) {
        commentLines.push(`- ${t}`);
      }
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
      evidence: [
        {
          source: 'issue_title',
          content: context.issue.title,
        },
      ],
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
      // Standard sequential tasks (serialized explicitly)
      tasks.push(
        {
          id: 'task-1',
          title: 'Write interfaces',
          objective: 'Create ts files under interfaces folder',
          filesToInspect: ['src/ai/interfaces/'],
          allowedOperations: ['create'],
          dependencies: [],
          parallelizationGuidance: 'No parallel tasks.',
          verificationCommands: ['npm run build'],
          completionEvidence: 'Files compile.',
          ownerType: 'coding_agent',
        },
        {
          id: 'task-2',
          title: 'Write schemas',
          objective: 'Write schema files',
          filesToInspect: ['src/ai/schemas/'],
          allowedOperations: ['create'],
          dependencies: ['task-1'], // Serialized dependency
          parallelizationGuidance: 'Depends on task-1.',
          verificationCommands: ['npm run build'],
          completionEvidence: 'Schemas compiled.',
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
    }

    return {
      workflow: 'split',
      tasks,
      commentBody: commentLines.join('\n'),
      confidence: 'high',
      assumptions: [],
      evidence: [],
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
