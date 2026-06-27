import { Injectable, Logger } from '@nestjs/common';
import { JobService } from '../../job/job.service';
import { IssueTriageContextBuilder } from '../../context/builders/issue-triage-context.builder';
import { AiClient } from '../../ai/interfaces/ai-client.interface';
import { TriagePolicyService } from '../../policy/services/triage-policy.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { validateTriageOutput } from '../../ai/schemas/triage-output.schema';
import { Job } from '../../job/interfaces/job.interface';

/**
 * Hidden HTML marker for triage comments.
 * Used for idempotent upsert — future runs can find and update this comment.
 */
function triageMarker(issueNumber: number): string {
  return `<!-- ruan-ai:workflow=triage issue=${issueNumber} logical=triage-result version=1 -->`;
}

/**
 * Result of a triage workflow execution.
 */
export interface TriageWorkflowResult {
  success: boolean;
  labelsApplied: string[];
  labelsRejected: Array<{ label: string; reason: string }>;
  commentWritten: boolean;
  error?: string;
  warnings: string[];
}

/**
 * Orchestrates the issue triage workflow:
 *   1. Update job status → running
 *   2. Build triage context
 *   3. Request AI triage output
 *   4. Validate output schema
 *   5. Validate output against policy
 *   6. Write allowed labels and comment
 *   7. Update job status → completed/failed
 */
@Injectable()
export class TriageWorkflowService {
  private readonly logger = new Logger(TriageWorkflowService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly contextBuilder: IssueTriageContextBuilder,
    private readonly aiClient: AiClient,
    private readonly policyService: TriagePolicyService,
    private readonly githubWriter: GithubWriter,
  ) {}

  async execute(job: Job): Promise<TriageWorkflowResult> {
    this.logger.log(`Starting triage workflow for job ${job.jobId}`);

    // Step 1: Mark running
    await this.jobService.updateJobStatus(job.jobId, 'running');

    try {
      const owner = job.repositoryOwner;
      const repo = job.repositoryName;
      if (!owner || !repo) {
        throw new Error(
          `Job ${job.jobId} is missing repository owner/name metadata`,
        );
      }

      // Step 2: Build context
      const context = await this.contextBuilder.build({
        owner,
        repo,
        issueNumber: job.issueNumber!,
        senderLogin: job.senderLogin ?? '',
      });

      // Step 3: Request AI triage
      const rawOutput = await this.aiClient.triage(context);

      // Step 4: Validate output schema
      const validation = validateTriageOutput(rawOutput);
      if (!validation.valid || !validation.output) {
        const errorMsg = `AI output schema validation failed: ${validation.errors.join('; ')}`;
        this.logger.error(errorMsg);
        await this.jobService.updateJobStatus(job.jobId, 'failed');
        return {
          success: false,
          labelsApplied: [],
          labelsRejected: [],
          commentWritten: false,
          error: errorMsg,
          warnings: [],
        };
      }

      const triageOutput = validation.output;

      // Step 5: Validate against policy
      const policyResult = this.policyService.validate(
        triageOutput,
        context.repositoryLabels.map((l) => l.name),
        context.config,
      );

      // Step 6: Execute allowed writes
      const result: TriageWorkflowResult = {
        success: true,
        labelsApplied: [],
        labelsRejected: policyResult.rejectedLabels,
        commentWritten: false,
        warnings: policyResult.warnings,
      };

      // Apply allowed labels
      if (policyResult.allowedLabels.length > 0) {
        await this.githubWriter.applyLabels(
          owner,
          repo,
          job.issueNumber!,
          policyResult.allowedLabels,
        );
        result.labelsApplied = policyResult.allowedLabels;
        this.logger.log(
          `Applied labels: ${policyResult.allowedLabels.join(', ')}`,
        );
      }

      // Write triage comment
      if (policyResult.commentAllowed) {
        const marker = triageMarker(job.issueNumber!);
        let commentBody = triageOutput.commentBody;

        // Append rejection details if some labels were rejected
        if (policyResult.rejectedLabels.length > 0) {
          commentBody += '\n\n---\n';
          commentBody += `*${policyResult.rejectedLabels.length} suggested label(s) were rejected by policy:*\n`;
          for (const rejected of policyResult.rejectedLabels) {
            commentBody += `- \`${rejected.label}\`: ${rejected.reason}\n`;
          }
        }

        await this.githubWriter.upsertComment(
          owner,
          repo,
          job.issueNumber!,
          marker,
          commentBody,
        );
        result.commentWritten = true;
      } else {
        this.logger.warn(
          `Comment rejected by policy: ${policyResult.commentRejectionReason}`,
        );
      }

      // Step 7: Mark completed
      await this.jobService.updateJobStatus(job.jobId, 'completed');
      this.logger.log(`Triage workflow completed for job ${job.jobId}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Triage workflow failed for job ${job.jobId}: ${errorMsg}`,
      );
      await this.jobService.updateJobStatus(job.jobId, 'failed');
      return {
        success: false,
        labelsApplied: [],
        labelsRejected: [],
        commentWritten: false,
        error: errorMsg,
        warnings: [],
      };
    }
  }
}
