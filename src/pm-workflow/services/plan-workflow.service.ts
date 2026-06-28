import { Injectable, Logger } from '@nestjs/common';
import { JobService } from '../../job/job.service';
import { IssuePlanContextBuilder } from '../../context/builders/issue-plan-context.builder';
import { AiClient } from '../../ai/interfaces/ai-client.interface';
import { TriagePolicyService } from '../../policy/services/triage-policy.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { validatePlanOutput } from '../../ai/schemas/plan-output.schema';
import { Job } from '../../job/interfaces/job.interface';

function planMarker(issueNumber: number): string {
  return `<!-- ruan-ai:workflow=plan issue=${issueNumber} logical=active-plan version=1 -->`;
}

export interface PlanWorkflowResult {
  success: boolean;
  commentWritten: boolean;
  error?: string;
  warnings: string[];
}

@Injectable()
export class PlanWorkflowService {
  private readonly logger = new Logger(PlanWorkflowService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly contextBuilder: IssuePlanContextBuilder,
    private readonly aiClient: AiClient,
    private readonly policyService: TriagePolicyService,
    private readonly githubWriter: GithubWriter,
  ) {}

  async execute(job: Job): Promise<PlanWorkflowResult> {
    this.logger.log(`Starting plan workflow for job ${job.jobId}`);
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
      const rawOutput = await this.aiClient.plan(context);

      // 3. Schema validation
      let validation = validatePlanOutput(rawOutput);
      if (!validation.valid || !validation.output) {
        this.jobService.recordFailureEvent(
          job.jobId,
          'schema_validation_failure',
          `AI plan schema validation failed. Errors: ${validation.errors.join('; ')}`,
        );
        this.logger.warn(
          `AI plan schema validation failed. Initiating repair retry. Errors: ${validation.errors.join('; ')}`,
        );

        // Repair retry (exactly once)
        const contextSummary = `Planning workflow for repository ${owner}/${repo} issue #${job.issueNumber}`;
        const repairedRaw = (await this.aiClient.repair(
          validation.errors,
          contextSummary,
          'plan',
        )) as unknown;
        validation = validatePlanOutput(repairedRaw);

        if (!validation.valid || !validation.output) {
          const errorMsg = `AI plan repair retry failed. Schema errors: ${validation.errors.join('; ')}`;
          this.jobService.recordFailureEvent(
            job.jobId,
            'repair_schema_failure',
            errorMsg,
          );
          this.logger.error(errorMsg);
          await this.jobService.updateJobStatus(job.jobId, 'failed');
          return {
            success: false,
            commentWritten: false,
            error: errorMsg,
            warnings: [],
          };
        }
        this.logger.log('AI plan repair retry succeeded.');
      }

      const planOutput = validation.output;

      // 4. Policy validation
      const policyResult = this.policyService.validatePlan(planOutput);
      if (!policyResult.valid || !policyResult.commentAllowed) {
        const errorMsg = `Plan comment rejected by policy: ${policyResult.commentRejectionReason ?? 'Unknown reason'}`;
        this.logger.error(errorMsg);
        await this.jobService.updateJobStatus(job.jobId, 'failed');
        return {
          success: false,
          commentWritten: false,
          error: errorMsg,
          warnings: policyResult.warnings,
        };
      }

      // 5. Upsert planning comment
      const marker = planMarker(job.issueNumber!);
      try {
        await this.githubWriter.upsertComment(
          owner,
          repo,
          job.issueNumber!,
          marker,
          planOutput.commentBody,
        );
      } catch (err) {
        this.jobService.recordFailureEvent(
          job.jobId,
          'github_write_failure',
          `Failed to write plan comment: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      }

      await this.jobService.updateJobStatus(job.jobId, 'completed');
      this.logger.log(`Plan workflow completed for job ${job.jobId}`);

      return {
        success: true,
        commentWritten: true,
        warnings: policyResult.warnings,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Plan workflow failed for job ${job.jobId}: ${errorMsg}`,
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
