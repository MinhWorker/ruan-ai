import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import {
  NormalizedIssueEvent,
  NormalizedCommentEvent,
  NormalizedInstallationEvent,
} from './dto/normalized-event.dto';

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookService],
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
          body: 'Hello, please run /plan and check /status of the issue.',
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
        'Hello, please run /plan and check /status of the issue.',
      );
      expect(result.repositoryOwner).toBe('MinhWorker');
      expect(result.repositoryName).toBe('ruan-ai');
      expect(result.commands).toEqual(['/plan', '/status']);
      expect(result.sender.id).toBe(2);
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
