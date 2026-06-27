import { Injectable, Logger, Optional } from '@nestjs/common';
import { Job } from '../job/interfaces/job.interface';
import { ConfigService } from '../config/config.service';
import { PmWorkflowService } from '../pm-workflow/services/pm-workflow.service';
import { JobService } from '../job/job.service';
import { TelemetryService } from '../telemetry/services/telemetry.service';

export interface ExecutionResult {
  mode: 'inline' | 'queued';
  success?: boolean;
  error?: string;
}

@Injectable()
export class JobExecutionService {
  private readonly logger = new Logger(JobExecutionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly pmWorkflowService: PmWorkflowService,
    private readonly jobService: JobService,
    @Optional() private readonly telemetryService?: TelemetryService,
  ) {}

  async executeJob(job: Job): Promise<ExecutionResult> {
    if (this.configService.jobExecutionMode === 'queued') {
      this.logger.log(`Job ${job.jobId} execution skipped (mode is queued)`);
      if (this.telemetryService) {
        this.telemetryService.recordEvent({
          type: 'job_lifecycle',
          severity: 'info',
          jobId: job.jobId,
          message: 'Execution skipped because mode is queued',
        });
      }
      return { mode: 'queued' };
    }

    try {
      this.logger.log(`Starting execution for job ${job.jobId}`);
      if (this.telemetryService) {
        this.telemetryService.recordEvent({
          type: 'job_lifecycle',
          severity: 'info',
          jobId: job.jobId,
          message: `Started inline execution for job ${job.jobId}`,
        });
      }

      const workflowResult = await this.pmWorkflowService.processJob(job);
      if (
        workflowResult &&
        'success' in workflowResult &&
        workflowResult.success === false
      ) {
        throw new Error(workflowResult.error ?? 'Workflow execution failed');
      }

      this.logger.log(`Completed execution for job ${job.jobId}`);
      if (this.telemetryService) {
        this.telemetryService.recordEvent({
          type: 'job_lifecycle',
          severity: 'info',
          jobId: job.jobId,
          message: `Successfully executed job ${job.jobId}`,
        });
      }

      return { mode: 'inline', success: true };
    } catch (error) {
      this.logger.error(
        `Execution failed for job ${job.jobId}`,
        error instanceof Error ? error.stack : undefined,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (this.telemetryService) {
        this.telemetryService.recordEvent({
          type: 'job_lifecycle',
          severity: 'error',
          jobId: job.jobId,
          message: `Execution failed for job ${job.jobId}: ${errorMessage}`,
        });
      }

      try {
        await this.jobService.updateJobStatus(job.jobId, 'failed');
      } catch (updateError) {
        this.logger.error(
          `Failed to update job status to failed for ${job.jobId}`,
          updateError instanceof Error ? updateError.stack : undefined,
        );
      }

      return { mode: 'inline', success: false, error: 'Job execution failed' };
    }
  }
}
