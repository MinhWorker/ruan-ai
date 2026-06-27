import { Injectable, Logger, Optional } from '@nestjs/common';
import { GithubWriter } from '../interfaces/github-writer.interface';
import { TelemetryService } from '../../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../../telemetry/services/rate-limit-tracker.service';

/**
 * Recorded write operation for test assertions.
 */
export interface RecordedWrite {
  type: 'applyLabels' | 'upsertComment';
  owner: string;
  repo: string;
  issueNumber: number;
  labels?: string[];
  marker?: string;
  body?: string;
  timestamp: Date;
}

/**
 * In-memory fake GitHub writer for testing and local development.
 * Records all write operations for assertion. Does not make real API calls.
 */
@Injectable()
export class FakeGithubWriter extends GithubWriter {
  private readonly logger = new Logger(FakeGithubWriter.name);
  private readonly writes: RecordedWrite[] = [];
  private readonly issueLabels = new Map<string, Set<string>>();
  private readonly issueComments = new Map<string, Map<string, string>>();

  constructor(
    @Optional() private readonly telemetryService?: TelemetryService,
    @Optional() private readonly rateLimitTracker?: RateLimitTrackerService,
  ) {
    super();
  }

  /**
   * Get all recorded writes for test assertions.
   */
  getWrites(): readonly RecordedWrite[] {
    return this.writes;
  }

  /**
   * Get the current label set for an issue.
   */
  getLabels(owner: string, repo: string, issueNumber: number): string[] {
    const key = `${owner}/${repo}#${issueNumber}`;
    const labels = this.issueLabels.get(key);
    return labels ? Array.from(labels) : [];
  }

  /**
   * Get the current comment for a marker on an issue.
   */
  getComment(
    owner: string,
    repo: string,
    issueNumber: number,
    marker: string,
  ): string | undefined {
    const key = `${owner}/${repo}#${issueNumber}`;
    return this.issueComments.get(key)?.get(marker);
  }

  /**
   * Reset all recorded state. Useful between test cases.
   */
  reset(): void {
    this.writes.length = 0;
    this.issueLabels.clear();
    this.issueComments.clear();
  }

  async applyLabels(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[],
  ): Promise<void> {
    await Promise.resolve();
    const key = `${owner}/${repo}#${issueNumber}`;
    this.logger.log(`[FAKE] Applying labels [${labels.join(', ')}] to ${key}`);

    if (this.rateLimitTracker) {
      this.rateLimitTracker.recordGithubRequest();
    }
    if (this.telemetryService) {
      this.telemetryService.recordEvent({
        type: 'github_write',
        severity: 'info',
        message: 'Applied labels to issue',
        repositoryOwner: owner,
        repositoryName: repo,
        issueNumber,
        metadata: { labels },
      });
      this.telemetryService.recordAudit({
        repositoryOwner: owner,
        repositoryName: repo,
        issueNumber,
        proposedWriteSummary: `Applied labels: ${labels.join(', ')}`,
        policyDecision: 'allowed',
        writerResultMetadata: { type: 'applyLabels' },
      });
    }

    const existing = this.issueLabels.get(key) ?? new Set<string>();
    for (const label of labels) {
      existing.add(label);
    }
    this.issueLabels.set(key, existing);

    this.writes.push({
      type: 'applyLabels',
      owner,
      repo,
      issueNumber,
      labels: [...labels],
      timestamp: new Date(),
    });
  }

  async upsertComment(
    owner: string,
    repo: string,
    issueNumber: number,
    marker: string,
    body: string,
  ): Promise<void> {
    await Promise.resolve();
    const key = `${owner}/${repo}#${issueNumber}`;
    this.logger.log(`[FAKE] Upserting comment on ${key} with marker`);

    if (this.rateLimitTracker) {
      this.rateLimitTracker.recordGithubRequest();
    }
    if (this.telemetryService) {
      this.telemetryService.recordEvent({
        type: 'github_write',
        severity: 'info',
        message: 'Upserted comment on issue',
        repositoryOwner: owner,
        repositoryName: repo,
        issueNumber,
        metadata: { marker },
      });
      this.telemetryService.recordAudit({
        repositoryOwner: owner,
        repositoryName: repo,
        issueNumber,
        proposedWriteSummary: `Upserted comment with marker: ${marker}`,
        policyDecision: 'allowed',
        writerResultMetadata: { type: 'upsertComment', marker },
      });
    }

    const comments = this.issueComments.get(key) ?? new Map<string, string>();
    const fullBody = `${marker}\n${body}`;
    comments.set(marker, fullBody);
    this.issueComments.set(key, comments);

    this.writes.push({
      type: 'upsertComment',
      owner,
      repo,
      issueNumber,
      marker,
      body: fullBody,
      timestamp: new Date(),
    });
  }
}
