import { Injectable, Logger } from '@nestjs/common';
import { JobService } from '../../job/job.service';
import {
  TriageWorkflowService,
  TriageWorkflowResult,
} from './triage-workflow.service';
import {
  PlanWorkflowService,
  PlanWorkflowResult,
} from './plan-workflow.service';
import {
  SplitWorkflowService,
  SplitWorkflowResult,
} from './split-workflow.service';
import {
  StatusWorkflowService,
  StatusWorkflowResult,
} from './status-workflow.service';
import {
  BlockerWorkflowService,
  BlockerWorkflowResult,
} from './blocker-workflow.service';
import {
  StopWorkflowService,
  StopWorkflowResult,
} from './stop-workflow.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { Job } from '../../job/interfaces/job.interface';
import { WorkflowStateRepository } from '../../workflow-state/workflow-state.repository';

/**
 * Routes queued jobs to the appropriate workflow handler.
 */
@Injectable()
export class PmWorkflowService {
  private readonly logger = new Logger(PmWorkflowService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly triageWorkflowService: TriageWorkflowService,
    private readonly planWorkflowService: PlanWorkflowService,
    private readonly splitWorkflowService: SplitWorkflowService,
    private readonly statusWorkflowService: StatusWorkflowService,
    private readonly blockerWorkflowService: BlockerWorkflowService,
    private readonly stopWorkflowService: StopWorkflowService,
    private readonly githubWriter: GithubWriter,
    private readonly workflowStateRepository: WorkflowStateRepository,
  ) {}

  /**
   * Process a single job by routing it to the correct workflow.
   * Unsupported workflow types are logged and marked completed (no-op).
   */
  async processJob(
    job: Job,
  ): Promise<
    | TriageWorkflowResult
    | PlanWorkflowResult
    | SplitWorkflowResult
    | StatusWorkflowResult
    | BlockerWorkflowResult
    | StopWorkflowResult
    | null
  > {
    this.logger.log(
      `Processing job ${job.jobId} with workflow type: ${job.workflowType}`,
    );

    if (!job.issueNumber) {
      this.logger.error(
        `Job ${job.jobId} with type ${job.workflowType} has no issueNumber`,
      );
      await this.jobService.updateJobStatus(job.jobId, 'failed');
      return null;
    }

    await this.jobService.incrementAttempts(job.jobId);

    if (await this.shouldSkipAutomaticWorkflowForPause(job)) {
      this.logger.log(
        `Skipping automatic workflow ${job.workflowType} for paused issue ${job.issueNumber}`,
      );
      await this.jobService.updateJobStatus(job.jobId, 'paused');
      return {
        success: true,
        commentWritten: false,
        warnings: ['Issue is paused; automatic workflow skipped'],
      };
    }

    if (job.workflowType === 'issue.opened') {
      return this.triageWorkflowService.execute(job);
    }

    if (job.workflowType === 'comment.plan') {
      return this.planWorkflowService.execute(job);
    }

    if (job.workflowType === 'comment.split') {
      return this.splitWorkflowService.execute(job);
    }

    if (job.workflowType === 'comment.status') {
      return this.statusWorkflowService.execute(job);
    }

    if (job.workflowType === 'comment.blocker') {
      return this.blockerWorkflowService.execute(job);
    }

    if (job.workflowType === 'comment.stop') {
      return this.stopWorkflowService.execute(job);
    }

    if (job.workflowType === 'comment.unsupported') {
      const owner = job.repositoryOwner;
      const repo = job.repositoryName;
      if (owner && repo) {
        const commentBody = `The command you entered is not supported.\n\nSupported commands are:\n- \`/plan\`: Propose an implementation plan for this issue.\n- \`/split\`: Propose a coding-agent task split for this issue.\n- \`/status\`: Get current status of the issue.\n- \`/blocker\`: Analyze a reported blocker.\n- \`/stop\`: Pause AI management for this issue.`;
        const marker = `<!-- ruan-ai:workflow=unsupported-help issue=${job.issueNumber} -->`;
        await this.githubWriter.upsertComment(
          owner,
          repo,
          job.issueNumber,
          marker,
          commentBody,
        );
      }
      await this.jobService.updateJobStatus(job.jobId, 'completed');
      return {
        success: true,
        commentWritten: true,
        warnings: ['Unsupported command requested'],
      };
    }

    // Unsupported workflow types are no-op
    this.logger.log(
      `Workflow type '${job.workflowType}' is not yet supported. Marking as completed.`,
    );
    await this.jobService.updateJobStatus(job.jobId, 'completed');
    return null;
  }

  private async shouldSkipAutomaticWorkflowForPause(
    job: Job,
  ): Promise<boolean> {
    if (!isAutomaticIssueWorkflow(job.workflowType)) {
      return false;
    }
    if (!job.repositoryId || !job.issueNumber) {
      return false;
    }

    const pauseState = await this.workflowStateRepository.findState(
      job.repositoryId,
      job.issueNumber,
      'pause',
    );
    return pauseState?.status === 'paused';
  }
}

function isAutomaticIssueWorkflow(workflowType: string): boolean {
  return workflowType.startsWith('issue.');
}
