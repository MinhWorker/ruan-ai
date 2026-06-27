import { Injectable, Logger } from '@nestjs/common';
import { JobService } from '../../job/job.service';
import { FollowUpService } from '../../job/follow-up.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { Job } from '../../job/interfaces/job.interface';

function stopMarker(issueNumber: number): string {
  return `<!-- ruan-ai:workflow=stop issue=${issueNumber} logical=paused version=1 -->`;
}

export interface StopWorkflowResult {
  success: boolean;
  commentWritten: boolean;
  error?: string;
  warnings: string[];
}

@Injectable()
export class StopWorkflowService {
  private readonly logger = new Logger(StopWorkflowService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly followUpService: FollowUpService,
    private readonly githubWriter: GithubWriter,
  ) {}

  async execute(job: Job): Promise<StopWorkflowResult> {
    this.logger.log(`Starting stop workflow for job ${job.jobId}`);
    await this.jobService.updateJobStatus(job.jobId, 'running');

    try {
      const owner = job.repositoryOwner;
      const repo = job.repositoryName;
      if (!owner || !repo) {
        throw new Error(
          `Job ${job.jobId} is missing repository owner/name metadata`,
        );
      }

      // 1. Cancel pending follow-ups
      await this.followUpService.cancelPendingForIssue(
        job.issueNumber!,
        owner,
        repo,
      );

      // 2. Write pause marker comment
      const marker = stopMarker(job.issueNumber!);
      const commentBody =
        'The AI project manager has been paused on this issue. Scheduled follow-ups have been cancelled.';
      await this.githubWriter.upsertComment(
        owner,
        repo,
        job.issueNumber!,
        marker,
        commentBody,
      );

      // 3. Mark the job paused / completed
      // The prompt says: "Mark the issue/job paused using existing job status semantics and a small follow-up state abstraction."
      await this.jobService.updateJobStatus(job.jobId, 'paused');
      this.logger.log(
        `Stop workflow completed for job ${job.jobId}. Job marked paused.`,
      );

      return {
        success: true,
        commentWritten: true,
        warnings: [],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Stop workflow failed for job ${job.jobId}: ${errorMsg}`,
      );
      await this.jobService.updateJobStatus(job.jobId, 'failed');
      return {
        success: false,
        commentWritten: false,
        error: errorMsg,
        warnings: [],
      };
    }
  }
}
