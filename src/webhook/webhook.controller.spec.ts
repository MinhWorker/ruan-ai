import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { JobService } from '../job/job.service';
import { JobRepository } from '../job/job.repository';
import { InMemoryJobRepository } from '../job/in-memory-job.repository';
import { ConfigService } from '../config/config.service';
import { SignatureGuard } from './guards/signature.guard';
import { HttpException } from '@nestjs/common';
import { JobExecutionService } from '../execution/job-execution.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let jobService: JobService;

  beforeEach(async () => {
    const mockConfigService = {
      githubWebhookSecret: 'test-secret',
      botMentionName: 'ruangm-ai',
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        WebhookService,
        JobService,
        {
          provide: JobRepository,
          useClass: InMemoryJobRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: JobExecutionService,
          useValue: {
            executeJob: jest.fn().mockResolvedValue({ mode: 'queued' }),
          },
        },
      ],
    })
      .overrideGuard(SignatureGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<WebhookController>(WebhookController);
    jobService = module.get<JobService>(JobService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should throw HttpException when X-GitHub-Delivery header is missing', async () => {
      const headers = {};
      const body = { action: 'opened' };

      await expect(controller.handleWebhook(headers, body)).rejects.toThrow(
        HttpException,
      );
    });

    it('should return duplicate status when a job with delivery ID already exists', async () => {
      const headers = { 'x-github-delivery': 'dlv-1' };
      const body = { action: 'opened' };

      const existingJob = await jobService.createJob({
        deliveryId: 'dlv-1',
        workflowType: 'issues.opened',
      });

      const response = await controller.handleWebhook(headers, body);
      expect(response).toEqual({
        status: 'duplicate',
        jobId: existingJob.jobId,
      });
    });

    it('should return ignored status when event is not supported', async () => {
      const headers = {
        'x-github-delivery': 'dlv-2',
        'x-github-event': 'star',
      };
      const body = { action: 'created' };

      const response = await controller.handleWebhook(headers, body);
      expect(response).toEqual({
        status: 'ignored',
        reason: 'Unsupported event type or action',
      });
    });

    it('should create a job and return accepted status for a valid supported event', async () => {
      const headers = {
        'x-github-delivery': 'dlv-3',
        'x-github-event': 'issues',
      };
      const body = {
        action: 'opened',
        issue: { number: 7 },
        repository: {
          id: 777,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'octocat', id: 1 },
      };

      const response = await controller.handleWebhook(headers, body);
      expect(response.status).toBe('accepted');
      expect(response.jobId).toBeDefined();

      const job = await jobService.getJobByDeliveryId('dlv-3');
      expect(job).not.toBeNull();
      expect(job?.issueNumber).toBe(7);
      expect(job?.repositoryId).toBe(777);
      expect(job?.repositoryOwner).toBe('MinhWorker');
      expect(job?.repositoryName).toBe('ruan-ai');
      expect(job?.senderLogin).toBe('octocat');
      expect(job?.workflowType).toBe('issue.opened');
    });

    it('should create a comment.plan job when /plan command is present', async () => {
      const headers = {
        'x-github-delivery': 'dlv-4',
        'x-github-event': 'issue_comment',
      };
      const body = {
        action: 'created',
        issue: { number: 7 },
        comment: { id: 101, body: 'Let us do this @ruangm-ai /plan now.' },
        repository: {
          id: 777,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'octocat', id: 1 },
      };

      const response = await controller.handleWebhook(headers, body);
      expect(response.status).toBe('accepted');

      const job = await jobService.getJobByDeliveryId('dlv-4');
      expect(job?.workflowType).toBe('comment.plan');
    });

    it('should create a comment.split job when /split command is present', async () => {
      const headers = {
        'x-github-delivery': 'dlv-5',
        'x-github-event': 'issue_comment',
      };
      const body = {
        action: 'created',
        issue: { number: 7 },
        comment: { id: 102, body: 'Run @ruangm-ai /split please.' },
        repository: {
          id: 777,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'octocat', id: 1 },
      };

      const response = await controller.handleWebhook(headers, body);
      expect(response.status).toBe('accepted');

      const job = await jobService.getJobByDeliveryId('dlv-5');
      expect(job?.workflowType).toBe('comment.split');
    });

    it('should select first command in textual order when both /split and /plan are present', async () => {
      const headers = {
        'x-github-delivery': 'dlv-6',
        'x-github-event': 'issue_comment',
      };
      const body = {
        action: 'created',
        issue: { number: 7 },
        comment: {
          id: 103,
          body: 'First @ruangm-ai /split then @ruangm-ai /plan.',
        },
        repository: {
          id: 777,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'octocat', id: 1 },
      };

      const response = await controller.handleWebhook(headers, body);
      expect(response.status).toBe('accepted');

      const job = await jobService.getJobByDeliveryId('dlv-6');
      expect(job?.workflowType).toBe('comment.split');
    });

    it('should create a comment.status job when /status command is present', async () => {
      const headers = {
        'x-github-delivery': 'dlv-status',
        'x-github-event': 'issue_comment',
      };
      const body = {
        action: 'created',
        issue: { number: 7 },
        comment: { id: 106, body: '@ruangm-ai /status now' },
        repository: {
          id: 777,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'octocat', id: 1 },
      };
      await controller.handleWebhook(headers, body);
      const job = await jobService.getJobByDeliveryId('dlv-status');
      expect(job?.workflowType).toBe('comment.status');
      expect(job?.repositoryOwner).toBe('MinhWorker');
      expect(job?.repositoryName).toBe('ruan-ai');
      expect(job?.commentId).toBe(106);
      expect(job?.commentBody).toBe('@ruangm-ai /status now');
    });

    it('should create a comment.blocker job when /blocker command is present', async () => {
      const headers = {
        'x-github-delivery': 'dlv-blocker',
        'x-github-event': 'issue_comment',
      };
      const body = {
        action: 'created',
        issue: { number: 7 },
        comment: { id: 107, body: '@ruangm-ai /blocker check' },
        repository: {
          id: 777,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'octocat', id: 1 },
      };
      await controller.handleWebhook(headers, body);
      const job = await jobService.getJobByDeliveryId('dlv-blocker');
      expect(job?.workflowType).toBe('comment.blocker');
      expect(job?.commentId).toBe(107);
      expect(job?.commentBody).toBe('@ruangm-ai /blocker check');
    });

    it('should create a comment.stop job when /stop command is present', async () => {
      const headers = {
        'x-github-delivery': 'dlv-stop',
        'x-github-event': 'issue_comment',
      };
      const body = {
        action: 'created',
        issue: { number: 7 },
        comment: { id: 108, body: '@ruangm-ai /stop now' },
        repository: {
          id: 777,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'octocat', id: 1 },
      };
      await controller.handleWebhook(headers, body);
      const job = await jobService.getJobByDeliveryId('dlv-stop');
      expect(job?.workflowType).toBe('comment.stop');
    });

    it('should return ignored status when comment has no commands', async () => {
      const headers = {
        'x-github-delivery': 'dlv-7',
        'x-github-event': 'issue_comment',
      };
      const body = {
        action: 'created',
        issue: { number: 7 },
        comment: { id: 104, body: 'Just a normal comment.' },
        repository: {
          id: 777,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'octocat', id: 1 },
      };

      const response = await controller.handleWebhook(headers, body);
      expect(response.status).toBe('ignored');
    });

    it('should create comment.unsupported job when only unsupported commands are present', async () => {
      const headers = {
        'x-github-delivery': 'dlv-8',
        'x-github-event': 'issue_comment',
      };
      const body = {
        action: 'created',
        issue: { number: 7 },
        comment: {
          id: 105,
          body: 'Call @ruangm-ai /magic or @ruangm-ai /deploy.',
        },
        repository: {
          id: 777,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'octocat', id: 1 },
      };

      const response = await controller.handleWebhook(headers, body);
      expect(response.status).toBe('accepted');

      const job = await jobService.getJobByDeliveryId('dlv-8');
      expect(job?.workflowType).toBe('comment.unsupported');
    });
  });
});
