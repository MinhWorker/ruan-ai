import { Injectable, Logger } from '@nestjs/common';
import { NormalizedEvent } from './dto/normalized-event.dto';
import { ConfigService } from '../config/config.service';

export interface GitHubWebhookBody {
  action?: string;
  issue?: {
    number: number;
    title?: string;
    body?: string;
  };
  comment?: {
    id: number;
    body?: string;
  };
  installation?: {
    id: number;
  };
  repositories?: { id: number }[];
  repository?: {
    id: number;
    name?: string;
    full_name?: string;
    owner?: {
      login?: string;
    };
  };
  sender?: {
    login: string;
    id: number;
    type?: string;
  };
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly configService: ConfigService) {}

  normalizeEvent(
    headers: Record<string, string | string[] | undefined>,
    body: GitHubWebhookBody,
  ): NormalizedEvent | null {
    // Standardize header lookup (allow case-insensitive or array headers)
    const getHeader = (key: string): string | undefined => {
      const val = headers[key] || headers[key.toLowerCase()];
      if (Array.isArray(val)) {
        return val[0];
      }
      return val;
    };

    const eventName = getHeader('x-github-event');
    if (!eventName) {
      this.logger.warn('No x-github-event header provided');
      return null;
    }

    const action = body?.action;
    if (!action) {
      return null;
    }

    const repositoryId = body?.repository?.id;
    const repositoryOwner =
      body?.repository?.owner?.login ||
      body?.repository?.full_name?.split('/')[0] ||
      '';
    const repositoryName =
      body?.repository?.name ||
      body?.repository?.full_name?.split('/')[1] ||
      '';
    this.logger.log(
      `Normalizing webhook event: ${eventName}.${action} for repository: ${repositoryId}`,
    );

    if (eventName === 'issues') {
      if (['opened', 'edited', 'reopened'].includes(action) && body.issue) {
        return {
          eventType: 'issue',
          action: action as 'opened' | 'edited' | 'reopened',
          issueNumber: body.issue.number,
          title: body.issue.title || '',
          body: body.issue.body || '',
          repositoryId: repositoryId || 0,
          repositoryOwner,
          repositoryName,
          sender: {
            login: body.sender?.login || '',
            id: body.sender?.id || 0,
          },
        };
      }
    } else if (eventName === 'issue_comment') {
      if (action === 'created' && body.issue && body.comment) {
        if (body.sender?.type === 'Bot') {
          this.logger.log(
            `Ignoring comment created by Bot: ${body.sender.login}`,
          );
          return null;
        }
        const commentBody = body.comment.body || '';
        const commands = this.extractCommands(commentBody);
        return {
          eventType: 'comment',
          action: 'created',
          issueNumber: body.issue.number,
          commentId: body.comment.id,
          body: commentBody,
          repositoryId: repositoryId || 0,
          repositoryOwner,
          repositoryName,
          commands,
          sender: {
            login: body.sender?.login || '',
            id: body.sender?.id || 0,
          },
        };
      }
    } else if (eventName === 'installation') {
      if (['created', 'deleted'].includes(action) && body.installation) {
        const repoIds = (body.repositories || []).map(
          (r: { id: number }) => r.id,
        );
        return {
          eventType: 'installation',
          action: action as 'created' | 'deleted',
          installationId: body.installation.id,
          repositoryIds: repoIds,
          sender: {
            login: body.sender?.login || '',
            id: body.sender?.id || 0,
          },
        };
      }
    }

    this.logger.log(`Ignored unsupported event type: ${eventName}.${action}`);
    return null;
  }

  private extractCommands(text: string): string[] {
    if (!text) return [];

    const botName = this.escapeRegExp(this.configService.botMentionName);
    const regex = new RegExp(`@${botName}\\s+(\\/[a-zA-Z0-9_-]+)`, 'g');
    const matches = Array.from(text.matchAll(regex));

    if (matches.length === 0) return [];
    return matches.map((m) => m[1].toLowerCase());
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
