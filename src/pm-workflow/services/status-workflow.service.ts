import { Injectable, Logger } from '@nestjs/common';
import { JobService } from '../../job/job.service';
import { IssueStatusContextBuilder } from '../../context/builders/issue-status-context.builder';
import { AiClient } from '../../ai/interfaces/ai-client.interface';
import { TriagePolicyService } from '../../policy/services/triage-policy.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { validateStatusOutput } from '../../ai/schemas/status-output.schema';
import { Job } from '../../job/interfaces/job.interface';

function statusMarker(issueNumber: number): string {
  return `<!-- ruan-ai:workflow=status issue=${issueNumber} logical=current-status version=1 -->`;
}

export interface StatusWorkflowResult {
  success: boolean;
  commentWritten: boolean;
  error?: string;
  warnings: string[];
}

@Injectable()
export class StatusWorkflowService {
  private readonly logger = new Logger(StatusWorkflowService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly contextBuilder: IssueStatusContextBuilder,
    private readonly aiClient: AiClient,
    private readonly policyService: TriagePolicyService,
    private readonly githubWriter: GithubWriter,
  ) {}

  async execute(job: Job): Promise<StatusWorkflowResult> {
    this.logger.log(`Starting status workflow for job ${job.jobId}`);
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
      });

      // 2. Query AI
      const rawOutput = await this.aiClient.status(context);

      // 3. Schema validation
      let validation = validateStatusOutput(rawOutput);
      if (!validation.valid || !validation.output) {
        this.logger.warn(
          `AI status schema validation failed. Initiating repair retry. Errors: ${validation.errors.join('; ')}`,
        );

        // Repair retry (exactly once)
        const contextSummary = `Status workflow for repository ${owner}/${repo} issue #${job.issueNumber}`;
        const repairedRaw = (await this.aiClient.repair(
          validation.errors,
          contextSummary,
        )) as unknown;
        validation = validateStatusOutput(repairedRaw);

        if (!validation.valid || !validation.output) {
          const errorMsg = `AI status repair retry failed. Schema errors: ${validation.errors.join('; ')}`;
          this.logger.error(errorMsg);
          await this.jobService.updateJobStatus(job.jobId, 'failed');
          return {
            success: false,
            commentWritten: false,
            error: errorMsg,
            warnings: [],
          };
        }
        this.logger.log('AI status repair retry succeeded.');
      }

      const statusOutput = validation.output;

      // 4. Policy validation
      const policyResult = this.policyService.validateStatus(statusOutput);
      if (!policyResult.valid || !policyResult.commentAllowed) {
        const errorMsg = `Status comment rejected by policy: ${policyResult.commentRejectionReason ?? 'Unknown reason'}`;
        this.logger.error(errorMsg);
        await this.jobService.updateJobStatus(job.jobId, 'failed');
        return {
          success: false,
          commentWritten: false,
          error: errorMsg,
          warnings: policyResult.warnings,
        };
      }

      // 5. Upsert status comment
      const marker = statusMarker(job.issueNumber!);
      await this.githubWriter.upsertComment(
        owner,
        repo,
        job.issueNumber!,
        marker,
        statusOutput.commentBody,
      );

      await this.jobService.updateJobStatus(job.jobId, 'completed');
      this.logger.log(`Status workflow completed for job ${job.jobId}`);

      return {
        success: true,
        commentWritten: true,
        warnings: policyResult.warnings,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Status workflow failed for job ${job.jobId}: ${errorMsg}`,
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
