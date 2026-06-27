import { Injectable, Logger } from '@nestjs/common';
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

  async triage(context: IssueTriageContext): Promise<TriageOutput> {
    await Promise.resolve();
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
  ) => any;

  setRepairBehavior(
    fn: (validationErrors: string[], contextSummary: string) => any,
  ) {
    this.repairBehavior = fn;
  }

  async plan(context: IssuePlanContext): Promise<PlanOutput> {
    await Promise.resolve();
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

  async repair(
    validationErrors: string[],
    contextSummary: string,
  ): Promise<any> {
    await Promise.resolve();
    this.logger.log(
      `[FAKE AI] Repairing invalid output for summary: ${contextSummary}`,
    );

    if (this.repairBehavior) {
      return this.repairBehavior(validationErrors, contextSummary);
    }

    if (contextSummary.includes('plan')) {
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
}
