import {
  Controller,
  Post,
  Headers,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  HttpException,
} from '@nestjs/common';
import { SignatureGuard } from './guards/signature.guard';
import { WebhookService } from './webhook.service';
import type { GitHubWebhookBody } from './webhook.service';
import { JobService } from '../job/job.service';
import { JobExecutionService } from '../execution/job-execution.service';

@Controller('github/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly jobService: JobService,
    private readonly jobExecutionService: JobExecutionService,
  ) {}

  @Post()
  @UseGuards(SignatureGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: GitHubWebhookBody,
  ) {
    const getHeader = (key: string): string | undefined => {
      const val = headers[key] || headers[key.toLowerCase()];
      if (Array.isArray(val)) {
        return val[0];
      }
      return val;
    };

    const deliveryId = getHeader('x-github-delivery');
    if (!deliveryId) {
      throw new HttpException(
        'Missing X-GitHub-Delivery header',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Step 1: Check duplication
    const existingJob = await this.jobService.getJobByDeliveryId(deliveryId);
    if (existingJob) {
      this.logger.log(
        `Received duplicate webhook. Delivery ID: ${deliveryId}. Skipping.`,
      );
      return {
        status: 'duplicate',
        jobId: existingJob.jobId,
      };
    }

    // Step 2: Normalize
    const normalized = this.webhookService.normalizeEvent(headers, payload);
    if (!normalized) {
      this.logger.log(
        `Event ignored (unsupported or skipped). Delivery ID: ${deliveryId}`,
      );
      return {
        status: 'ignored',
        reason: 'Unsupported event type or action',
      };
    }

    // Step 3: Create Job (in queued state)
    let issueNumber: number | undefined;
    let repositoryId: number | undefined;
    let repositoryOwner: string | undefined;
    let repositoryName: string | undefined;
    let senderLogin: string | undefined;
    let commentId: number | undefined;
    let commentBody: string | undefined;
    let installationId: number | undefined;

    if (normalized.eventType === 'issue') {
      issueNumber = normalized.issueNumber;
      repositoryId = normalized.repositoryId;
      repositoryOwner = normalized.repositoryOwner;
      repositoryName = normalized.repositoryName;
      senderLogin = normalized.sender.login;
    } else if (normalized.eventType === 'comment') {
      issueNumber = normalized.issueNumber;
      repositoryId = normalized.repositoryId;
      repositoryOwner = normalized.repositoryOwner;
      repositoryName = normalized.repositoryName;
      senderLogin = normalized.sender.login;
      commentId = normalized.commentId;
      commentBody = normalized.body;
    } else if (normalized.eventType === 'installation') {
      installationId = normalized.installationId;
      if (normalized.repositoryIds && normalized.repositoryIds.length > 0) {
        repositoryId = normalized.repositoryIds[0];
      }
    }

    let workflowType = `${normalized.eventType}.${normalized.action}`;
    if (normalized.eventType === 'comment') {
      // Find the first recognized command in textual order
      const recognized = normalized.commands.find(
        (cmd) =>
          cmd === '/plan' ||
          cmd === '/split' ||
          cmd === '/status' ||
          cmd === '/blocker' ||
          cmd === '/stop',
      );
      if (recognized) {
        workflowType = `comment.${recognized.slice(1)}`; // comment.plan or comment.split
      } else if (normalized.commands.length > 0) {
        workflowType = 'comment.unsupported';
      } else {
        // Normal comment with no commands is ignored
        this.logger.log(
          `Ignoring normal comment without commands on issue #${normalized.issueNumber}`,
        );
        return {
          status: 'ignored',
          reason: 'No slash commands in comment',
        };
      }
    }

    const job = await this.jobService.createJob({
      deliveryId,
      workflowType,
      issueNumber,
      repositoryId,
      repositoryOwner,
      repositoryName,
      senderLogin,
      commentId,
      commentBody,
      installationId,
    });

    const execution = await this.jobExecutionService.executeJob(job);

    return {
      status: 'accepted',
      jobId: job.jobId,
      execution,
    };
  }
}
