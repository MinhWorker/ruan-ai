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
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { Job } from '../../job/interfaces/job.interface';

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
    private readonly githubWriter: GithubWriter,
  ) {}

  /**
   * Process a single job by routing it to the correct workflow.
   * Unsupported workflow types are logged and marked completed (no-op).
   */
  async processJob(
    job: Job,
  ): Promise<
    TriageWorkflowResult | PlanWorkflowResult | SplitWorkflowResult | null
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

    if (job.workflowType === 'issue.opened') {
      return this.triageWorkflowService.execute(job);
    }

    if (job.workflowType === 'comment.plan') {
      return this.planWorkflowService.execute(job);
    }

    if (job.workflowType === 'comment.split') {
      return this.splitWorkflowService.execute(job);
    }

    if (job.workflowType === 'comment.unsupported') {
      const owner = job.repositoryOwner;
      const repo = job.repositoryName;
      if (owner && repo) {
        const commentBody = `The command you entered is not supported.\n\nSupported commands are:\n- \`/plan\`: Propose an implementation plan for this issue.\n- \`/split\`: Propose a coding-agent task split for this issue.`;
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
}
