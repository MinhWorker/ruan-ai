import { Injectable } from '@nestjs/common';
import {
  GithubClient,
  RepositoryLabel,
  IssueData,
  RepositoryData,
  IssueComment,
  PullRequestContext,
  CheckRunContext,
  RelatedIssueContext,
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
  private comments = new Map<string, IssueComment[]>();
  private linkedPullRequests = new Map<string, PullRequestContext[]>();
  private checkRuns = new Map<string, CheckRunContext[]>();
  private relatedIssues = new Map<string, RelatedIssueContext[]>();
  private linkedPullRequestsError?: Error;
  private checkRunsError?: Error;
  private relatedIssuesError?: Error;

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

  /**
   * Pre-populate comments for an issue.
   */
  setComments(
    owner: string,
    repo: string,
    issueNumber: number,
    comments: IssueComment[],
  ): void {
    this.comments.set(`${owner}/${repo}#${issueNumber}`, comments);
  }

  setLinkedPullRequests(
    owner: string,
    repo: string,
    issueNumber: number,
    pullRequests: PullRequestContext[],
  ): void {
    this.linkedPullRequests.set(
      `${owner}/${repo}#${issueNumber}`,
      pullRequests,
    );
  }

  setCheckRuns(
    owner: string,
    repo: string,
    ref: string,
    checkRuns: CheckRunContext[],
  ): void {
    this.checkRuns.set(`${owner}/${repo}@${ref}`, checkRuns);
  }

  setRelatedIssues(
    owner: string,
    repo: string,
    issueNumber: number,
    issues: RelatedIssueContext[],
  ): void {
    this.relatedIssues.set(`${owner}/${repo}#${issueNumber}`, issues);
  }

  failLinkedPullRequestsOnce(error: Error): void {
    this.linkedPullRequestsError = error;
  }

  failCheckRunsOnce(error: Error): void {
    this.checkRunsError = error;
  }

  failRelatedIssuesOnce(error: Error): void {
    this.relatedIssuesError = error;
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

  getIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<IssueComment[]> {
    const key = `${owner}/${repo}#${issueNumber}`;
    return Promise.resolve(this.comments.get(key) ?? []);
  }

  getLinkedPullRequests(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<PullRequestContext[]> {
    if (this.linkedPullRequestsError) {
      const error = this.linkedPullRequestsError;
      this.linkedPullRequestsError = undefined;
      return Promise.reject(error);
    }
    const key = `${owner}/${repo}#${issueNumber}`;
    return Promise.resolve(this.linkedPullRequests.get(key) ?? []);
  }

  getCheckRunsForRef(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<CheckRunContext[]> {
    if (this.checkRunsError) {
      const error = this.checkRunsError;
      this.checkRunsError = undefined;
      return Promise.reject(error);
    }
    const key = `${owner}/${repo}@${ref}`;
    return Promise.resolve(this.checkRuns.get(key) ?? []);
  }

  getRelatedIssues(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<RelatedIssueContext[]> {
    if (this.relatedIssuesError) {
      const error = this.relatedIssuesError;
      this.relatedIssuesError = undefined;
      return Promise.reject(error);
    }
    const key = `${owner}/${repo}#${issueNumber}`;
    return Promise.resolve(this.relatedIssues.get(key) ?? []);
  }
}
