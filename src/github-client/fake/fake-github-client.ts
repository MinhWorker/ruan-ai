import { Injectable } from '@nestjs/common';
import {
  GithubClient,
  RepositoryLabel,
  IssueData,
  RepositoryData,
} from '../interfaces/github-client.interface';

/**
 * Default repository labels for the fake client.
 * These simulate a typical repository label set for testing.
 */
const DEFAULT_LABELS: RepositoryLabel[] = [
  { name: 'bug', description: "Something isn't working", color: 'd73a4a' },
  {
    name: 'enhancement',
    description: 'New feature or request',
    color: 'a2eeef',
  },
  {
    name: 'documentation',
    description: 'Improvements or additions to documentation',
    color: '0075ca',
  },
  {
    name: 'question',
    description: 'Further information is requested',
    color: 'd876e3',
  },
  {
    name: 'good first issue',
    description: 'Good for newcomers',
    color: '7057ff',
  },
  {
    name: 'help wanted',
    description: 'Extra attention is needed',
    color: '008672',
  },
  {
    name: 'duplicate',
    description: 'This issue or pull request already exists',
    color: 'cfd3d7',
  },
  { name: 'invalid', description: "This doesn't seem right", color: 'e4e669' },
  {
    name: 'wontfix',
    description: 'This will not be worked on',
    color: 'ffffff',
  },
  {
    name: 'ruan:needs-info',
    description: 'Missing information required',
    color: 'fbca04',
  },
  { name: 'ruan:planned', description: 'Has an active plan', color: '0e8a16' },
  {
    name: 'ruan:blocked',
    description: 'Blocked by dependency or decision',
    color: 'b60205',
  },
];

/**
 * In-memory fake GitHub client for testing and local development.
 * Returns deterministic data without making real GitHub API calls.
 *
 * Test code can use setLabels/setIssue/setRepository to configure
 * specific state before running assertions.
 */
@Injectable()
export class FakeGithubClient extends GithubClient {
  private labels = new Map<string, RepositoryLabel[]>();
  private issues = new Map<string, IssueData>();
  private repositories = new Map<string, RepositoryData>();

  /**
   * Pre-populate labels for a repository.
   */
  setLabels(owner: string, repo: string, labels: RepositoryLabel[]): void {
    this.labels.set(`${owner}/${repo}`, labels);
  }

  /**
   * Pre-populate an issue for a repository.
   */
  setIssue(owner: string, repo: string, issue: IssueData): void {
    this.issues.set(`${owner}/${repo}#${issue.number}`, issue);
  }

  /**
   * Pre-populate repository metadata.
   */
  setRepository(owner: string, repo: string, data: RepositoryData): void {
    this.repositories.set(`${owner}/${repo}`, data);
  }

  getRepositoryLabels(owner: string, repo: string): Promise<RepositoryLabel[]> {
    const key = `${owner}/${repo}`;
    return Promise.resolve(this.labels.get(key) ?? [...DEFAULT_LABELS]);
  }

  getIssue(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<IssueData> {
    const key = `${owner}/${repo}#${issueNumber}`;
    const issue = this.issues.get(key);
    if (issue) {
      return Promise.resolve(issue);
    }
    return Promise.resolve({
      number: issueNumber,
      title: 'Default fake issue',
      body: 'Default fake issue body',
      author: 'test-user',
      createdAt: new Date().toISOString(),
      labels: [],
    });
  }

  getRepository(owner: string, repo: string): Promise<RepositoryData> {
    const key = `${owner}/${repo}`;
    const data = this.repositories.get(key);
    if (data) {
      return Promise.resolve(data);
    }
    return Promise.resolve({
      id: 12345,
      fullName: `${owner}/${repo}`,
      defaultBranch: 'main',
    });
  }
}
