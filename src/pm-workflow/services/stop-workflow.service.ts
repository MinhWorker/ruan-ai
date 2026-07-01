import { Injectable, Logger } from '@nestjs/common';
import { JobService } from '../../job/job.service';
import { FollowUpService } from '../../job/follow-up.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { Job } from '../../job/interfaces/job.interface';
import { WorkflowStateRepository } from '../../workflow-state/workflow-state.repository';
import { randomUUID } from 'crypto';

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
    private readonly workflowStateRepository: WorkflowStateRepository,
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

      if (!job.repositoryId) {
        throw new Error(`Job ${job.jobId} is missing repository ID metadata`);
      }

      const now = new Date();
      const savedState = await this.workflowStateRepository.saveState({
        installationId: job.installationId,
        repositoryId: job.repositoryId,
        repositoryOwner: owner,
        repositoryName: repo,
        issueNumber: job.issueNumber!,
        workflowType: 'pause',
        status: 'paused',
        payload: {
          reason: 'stop_command',
          cancelledFollowUps: true,
          manualCommandsAllowed: true,
        },
        markerLogical: 'paused',
        markerVersion: 1,
        stateVersion: 0,
        createdAt: now,
        updatedAt: now,
      });

      await this.workflowStateRepository.appendEvent({
        eventId: randomUUID(),
        repositoryId: job.repositoryId,
        issueNumber: job.issueNumber!,
        workflowType: 'pause',
        eventType: 'state_transition',
        stateVersion: savedState.stateVersion,
        payload: {
          to: 'paused',
          reason: 'stop_command',
          jobId: job.jobId,
          manualCommandsAllowed: true,
        },
        createdAt: new Date(),
      });

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
