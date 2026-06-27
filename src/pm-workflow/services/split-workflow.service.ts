import { Injectable, Logger } from '@nestjs/common';
import { JobService } from '../../job/job.service';
import { IssueSplitContextBuilder } from '../../context/builders/issue-split-context.builder';
import { AiClient } from '../../ai/interfaces/ai-client.interface';
import { TriagePolicyService } from '../../policy/services/triage-policy.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { validateSplitOutput } from '../../ai/schemas/split-output.schema';
import { Job } from '../../job/interfaces/job.interface';

function splitMarker(issueNumber: number): string {
  return `<!-- ruan-ai:workflow=split issue=${issueNumber} logical=task-split version=1 -->`;
}

export interface SplitWorkflowResult {
  success: boolean;
  commentWritten: boolean;
  error?: string;
  warnings: string[];
}

@Injectable()
export class SplitWorkflowService {
  private readonly logger = new Logger(SplitWorkflowService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly contextBuilder: IssueSplitContextBuilder,
    private readonly aiClient: AiClient,
    private readonly policyService: TriagePolicyService,
    private readonly githubWriter: GithubWriter,
  ) {}

  async execute(job: Job): Promise<SplitWorkflowResult> {
    this.logger.log(`Starting split workflow for job ${job.jobId}`);
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
      const rawOutput = await this.aiClient.split(context);

      // 3. Schema validation
      let validation = validateSplitOutput(rawOutput);
      if (!validation.valid || !validation.output) {
        this.logger.warn(
          `AI split schema validation failed. Initiating repair retry. Errors: ${validation.errors.join('; ')}`,
        );

        // Repair retry (exactly once)
        const contextSummary = `Task splitting workflow for repository ${owner}/${repo} issue #${job.issueNumber}`;
        const repairedRaw = (await this.aiClient.repair(
          validation.errors,
          contextSummary,
          'split',
        )) as unknown;
        validation = validateSplitOutput(repairedRaw);

        if (!validation.valid || !validation.output) {
          const errorMsg = `AI split repair retry failed. Schema errors: ${validation.errors.join('; ')}`;
          this.logger.error(errorMsg);
          await this.jobService.updateJobStatus(job.jobId, 'failed');
          return {
            success: false,
            commentWritten: false,
            error: errorMsg,
            warnings: [],
          };
        }
        this.logger.log('AI split repair retry succeeded.');
      }

      const splitOutput = validation.output;

      // 4. Policy validation
      const hasActivePlan = context.activePlanComment !== '';
      const policyResult = this.policyService.validateSplit(
        splitOutput,
        hasActivePlan,
      );
      if (!policyResult.valid || !policyResult.commentAllowed) {
        const errorMsg = `Split comment rejected by policy: ${policyResult.commentRejectionReason ?? 'Unknown reason'}`;
        this.logger.error(errorMsg);
        await this.jobService.updateJobStatus(job.jobId, 'failed');
        return {
          success: false,
          commentWritten: false,
          error: errorMsg,
          warnings: policyResult.warnings,
        };
      }

      // 5. Upsert split comment
      const marker = splitMarker(job.issueNumber!);
      await this.githubWriter.upsertComment(
        owner,
        repo,
        job.issueNumber!,
        marker,
        splitOutput.commentBody,
      );

      await this.jobService.updateJobStatus(job.jobId, 'completed');
      this.logger.log(`Split workflow completed for job ${job.jobId}`);

      return {
        success: true,
        commentWritten: true,
        warnings: policyResult.warnings,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Split workflow failed for job ${job.jobId}: ${errorMsg}`,
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
