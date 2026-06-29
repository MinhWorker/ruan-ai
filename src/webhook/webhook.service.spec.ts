import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import {
  NormalizedIssueEvent,
  NormalizedCommentEvent,
  NormalizedInstallationEvent,
} from './dto/normalized-event.dto';
import { ConfigService } from '../config/config.service';

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: ConfigService,
          useValue: { botMentionName: 'ruangm-ai' },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('normalizeEvent', () => {
    it('should normalize issues.opened event', () => {
      const headers = { 'x-github-event': 'issues' };
      const body = {
        action: 'opened',
        issue: {
          number: 101,
          title: 'Bug report',
          body: 'This is a bug',
        },
        repository: {
          id: 12345,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'octocat', id: 1 },
      };

      const result = service.normalizeEvent(
        headers,
        body,
      ) as NormalizedIssueEvent;
      expect(result).not.toBeNull();
      expect(result.eventType).toBe('issue');
      expect(result.action).toBe('opened');
      expect(result.issueNumber).toBe(101);
      expect(result.title).toBe('Bug report');
      expect(result.body).toBe('This is a bug');
      expect(result.repositoryId).toBe(12345);
      expect(result.repositoryOwner).toBe('MinhWorker');
      expect(result.repositoryName).toBe('ruan-ai');
      expect(result.sender.login).toBe('octocat');
    });

    it('should normalize issue_comment.created event and extract slash commands', () => {
      const headers = { 'x-github-event': 'issue_comment' };
      const body = {
        action: 'created',
        issue: { number: 42 },
        comment: {
          id: 999,
          body: 'Hello, please run @ruangm-ai /plan and check @ruangm-ai /status of the issue.',
        },
        repository: {
          id: 12345,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'coder', id: 2 },
      };

      const result = service.normalizeEvent(
        headers,
        body,
      ) as NormalizedCommentEvent;
      expect(result).not.toBeNull();
      expect(result.eventType).toBe('comment');
      expect(result.action).toBe('created');
      expect(result.issueNumber).toBe(42);
      expect(result.commentId).toBe(999);
      expect(result.body).toBe(
        'Hello, please run @ruangm-ai /plan and check @ruangm-ai /status of the issue.',
      );
      expect(result.repositoryOwner).toBe('MinhWorker');
      expect(result.repositoryName).toBe('ruan-ai');
      expect(result.commands).toEqual(['/plan', '/status']);
      expect(result.sender.id).toBe(2);
    });

    it('should ignore comment without bot mention: Staging /health returned status ok.', () => {
      const headers = { 'x-github-event': 'issue_comment' };
      const body = {
        action: 'created',
        issue: { number: 42 },
        comment: { id: 9991, body: 'Staging /health returned status ok.' },
        repository: {
          id: 12345,
          name: 'ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'coder', id: 2 },
      };
      const result = service.normalizeEvent(
        headers,
        body,
      ) as NormalizedCommentEvent;
      expect(result.commands).toEqual([]);
    });

    it('should ignore /status without @ruangm-ai', () => {
      const headers = { 'x-github-event': 'issue_comment' };
      const body = {
        action: 'created',
        issue: { number: 42 },
        comment: { id: 9992, body: 'Can we get a /status update?' },
        repository: {
          id: 12345,
          name: 'ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'coder', id: 2 },
      };
      const result = service.normalizeEvent(
        headers,
        body,
      ) as NormalizedCommentEvent;
      expect(result.commands).toEqual([]);
    });

    it('should ignore code block containing /status', () => {
      const headers = { 'x-github-event': 'issue_comment' };
      const body = {
        action: 'created',
        issue: { number: 42 },
        comment: { id: 9993, body: 'Run this:\n```\n/status\n```' },
        repository: {
          id: 12345,
          name: 'ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'coder', id: 2 },
      };
      const result = service.normalizeEvent(
        headers,
        body,
      ) as NormalizedCommentEvent;
      expect(result.commands).toEqual([]);
    });

    it('should extract unsupported command if explicit mention is used', () => {
      const headers = { 'x-github-event': 'issue_comment' };
      const body = {
        action: 'created',
        issue: { number: 42 },
        comment: { id: 9994, body: '@ruangm-ai /health' },
        repository: {
          id: 12345,
          name: 'ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'coder', id: 2 },
      };
      const result = service.normalizeEvent(
        headers,
        body,
      ) as NormalizedCommentEvent;
      expect(result.commands).toEqual(['/health']);
    });

    it('should treat configured bot mention as literal text in command extraction', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WebhookService,
          {
            provide: ConfigService,
            useValue: { botMentionName: 'ruangm.ai' },
          },
        ],
      }).compile();
      const serviceWithRegexLikeMention =
        module.get<WebhookService>(WebhookService);

      const headers = { 'x-github-event': 'issue_comment' };
      const body = {
        action: 'created',
        issue: { number: 42 },
        comment: {
          id: 9995,
          body: '@ruangm-ai /status\n@ruangm.ai /plan',
        },
        repository: {
          id: 12345,
          name: 'ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'coder', id: 2 },
      };

      const result = serviceWithRegexLikeMention.normalizeEvent(
        headers,
        body,
      ) as NormalizedCommentEvent;

      expect(result.commands).toEqual(['/plan']);
    });

    it('should ignore comment created by Bot containing /plan', () => {
      const headers = { 'x-github-event': 'issue_comment' };
      const body = {
        action: 'created',
        issue: { number: 42 },
        comment: {
          id: 1000,
          body: '@ruangm-ai /plan some task',
        },
        repository: {
          id: 12345,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'ruan-ai[bot]', id: 3, type: 'Bot' },
      };

      const result = service.normalizeEvent(headers, body);
      expect(result).toBeNull();
    });

    it('should ignore comment created by Bot containing /status and /split', () => {
      const headers = { 'x-github-event': 'issue_comment' };
      const body = {
        action: 'created',
        issue: { number: 42 },
        comment: {
          id: 1001,
          body: 'Check @ruangm-ai /status or @ruangm-ai /split',
        },
        repository: {
          id: 12345,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'dependabot[bot]', id: 4, type: 'Bot' },
      };

      const result = service.normalizeEvent(headers, body);
      expect(result).toBeNull();
    });

    it('should ignore comment created by Bot containing /blocker and /stop', () => {
      const headers = { 'x-github-event': 'issue_comment' };
      const body = {
        action: 'created',
        issue: { number: 42 },
        comment: {
          id: 1002,
          body: 'Blocked state noted. Try @ruangm-ai /blocker first, then @ruangm-ai /stop.',
        },
        repository: {
          id: 12345,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'ruangm-ai[bot]', id: 5, type: 'Bot' },
      };

      const result = service.normalizeEvent(headers, body);
      expect(result).toBeNull();
    });

    it('should normalize installation.created event', () => {
      const headers = { 'x-github-event': 'installation' };
      const body = {
        action: 'created',
        installation: { id: 112233 },
        repositories: [{ id: 500 }, { id: 600 }],
        sender: { login: 'admin', id: 3 },
      };

      const result = service.normalizeEvent(
        headers,
        body,
      ) as NormalizedInstallationEvent;
      expect(result).not.toBeNull();
      expect(result.eventType).toBe('installation');
      expect(result.action).toBe('created');
      expect(result.installationId).toBe(112233);
      expect(result.repositoryIds).toEqual([500, 600]);
      expect(result.sender.login).toBe('admin');
    });

    it('should return null for unsupported event types', () => {
      const headers = { 'x-github-event': 'star' };
      const body = { action: 'created', repository: { id: 123 } };

      const result = service.normalizeEvent(headers, body);
      expect(result).toBeNull();
    });

    it('should return null for unsupported actions on supported events', () => {
      const headers = { 'x-github-event': 'issues' };
      const body = { action: 'labeled', issue: { number: 10 } }; // 'labeled' is not mapped in MVP

      const result = service.normalizeEvent(headers, body);
      expect(result).toBeNull();
    });

    it('should return null if x-github-event header is missing', () => {
      const headers = {};
      const body = { action: 'opened' };

      const result = service.normalizeEvent(headers, body);
      expect(result).toBeNull();
    });
  });
});
