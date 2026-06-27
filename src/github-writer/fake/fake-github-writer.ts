import { Injectable, Logger } from '@nestjs/common';
import { GithubWriter } from '../interfaces/github-writer.interface';

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
