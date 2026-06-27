import { Injectable, Logger } from '@nestjs/common';
import { JobService } from '../../job/job.service';
import { IssueBlockerContextBuilder } from '../../context/builders/issue-blocker-context.builder';
import { AiClient } from '../../ai/interfaces/ai-client.interface';
import { TriagePolicyService } from '../../policy/services/triage-policy.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { validateBlockerOutput } from '../../ai/schemas/blocker-output.schema';
import { Job } from '../../job/interfaces/job.interface';

function blockerMarker(issueNumber: number): string {
  return `<!-- ruan-ai:workflow=blocker issue=${issueNumber} logical=current-blocker version=1 -->`;
}

export interface BlockerWorkflowResult {
  success: boolean;
  commentWritten: boolean;
  error?: string;
  warnings: string[];
}

@Injectable()
export class BlockerWorkflowService {
  private readonly logger = new Logger(BlockerWorkflowService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly contextBuilder: IssueBlockerContextBuilder,
    private readonly aiClient: AiClient,
    private readonly policyService: TriagePolicyService,
    private readonly githubWriter: GithubWriter,
  ) {}

  async execute(job: Job): Promise<BlockerWorkflowResult> {
    this.logger.log(`Starting blocker workflow for job ${job.jobId}`);
    await this.jobService.updateJobStatus(job.jobId, 'running');

    try {
      const owner = job.repositoryOwner;
      const repo = job.repositoryName;
      if (!owner || !repo) {
        throw new Error(
          `Job ${job.jobId} is missing repository owner/name metadata`,
        );
      }

      // 1. Build context
      const context = await this.contextBuilder.build({
        owner,
        repo,
        issueNumber: job.issueNumber!,
        senderLogin: job.senderLogin ?? '',
        triggeringCommentBody: job.commentBody ?? '',
      });

      // 2. Query AI
      const rawOutput = await this.aiClient.blocker(context);

      // 3. Schema validation
      let validation = validateBlockerOutput(rawOutput);
      if (!validation.valid || !validation.output) {
        this.logger.warn(
          `AI blocker schema validation failed. Initiating repair retry. Errors: ${validation.errors.join('; ')}`,
        );

        // Repair retry (exactly once)
        const contextSummary = `Blocker workflow for repository ${owner}/${repo} issue #${job.issueNumber}`;
        const repairedRaw = (await this.aiClient.repair(
          validation.errors,
          contextSummary,
          'blocker',
        )) as unknown;
        validation = validateBlockerOutput(repairedRaw);

        if (!validation.valid || !validation.output) {
          const errorMsg = `AI blocker repair retry failed. Schema errors: ${validation.errors.join('; ')}`;
          this.logger.error(errorMsg);
          await this.jobService.updateJobStatus(job.jobId, 'failed');
          return {
            success: false,
            commentWritten: false,
            error: errorMsg,
            warnings: [],
          };
        }
        this.logger.log('AI blocker repair retry succeeded.');
      }

      const blockerOutput = validation.output;

      // 4. Policy validation
      const policyResult = this.policyService.validateBlocker(blockerOutput);
      if (!policyResult.valid || !policyResult.commentAllowed) {
        const errorMsg = `Blocker comment rejected by policy: ${policyResult.commentRejectionReason ?? 'Unknown reason'}`;
        this.logger.error(errorMsg);
        await this.jobService.updateJobStatus(job.jobId, 'failed');
        return {
          success: false,
          commentWritten: false,
          error: errorMsg,
          warnings: policyResult.warnings,
        };
      }

      // 5. Upsert blocker comment
      const marker = blockerMarker(job.issueNumber!);
      await this.githubWriter.upsertComment(
        owner,
        repo,
        job.issueNumber!,
        marker,
        blockerOutput.commentBody,
      );

      await this.jobService.updateJobStatus(job.jobId, 'completed');
      this.logger.log(`Blocker workflow completed for job ${job.jobId}`);

      return {
        success: true,
        commentWritten: true,
        warnings: policyResult.warnings,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Blocker workflow failed for job ${job.jobId}: ${errorMsg}`,
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
