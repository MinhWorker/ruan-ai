import { Injectable, Logger } from '@nestjs/common';
import { JobService } from '../../job/job.service';
import {
  TriageWorkflowService,
  TriageWorkflowResult,
} from './triage-workflow.service';
import { Job } from '../../job/interfaces/job.interface';

/**
 * Routes queued jobs to the appropriate workflow handler.
 * For M2, only issue.opened → triage workflow is supported.
 */
@Injectable()
export class PmWorkflowService {
  private readonly logger = new Logger(PmWorkflowService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly triageWorkflowService: TriageWorkflowService,
  ) {}

  /**
   * Process a single job by routing it to the correct workflow.
   * Unsupported workflow types are logged and marked completed (no-op).
   */
  async processJob(job: Job): Promise<TriageWorkflowResult | null> {
    this.logger.log(
      `Processing job ${job.jobId} with workflow type: ${job.workflowType}`,
    );

    if (job.workflowType === 'issue.opened') {
      if (!job.issueNumber) {
        this.logger.error(
          `Job ${job.jobId} is issue.opened but has no issueNumber`,
        );
        await this.jobService.updateJobStatus(job.jobId, 'failed');
        return null;
      }

      await this.jobService.incrementAttempts(job.jobId);
      return this.triageWorkflowService.execute(job);
    }

    // Unsupported workflow types are no-op
    this.logger.log(
      `Workflow type '${job.workflowType}' is not yet supported. Marking as completed.`,
    );
    await this.jobService.updateJobStatus(job.jobId, 'completed');
    return null;
  }
}
