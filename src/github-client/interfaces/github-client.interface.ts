/**
 * Repository label as returned by GitHub API.
 */
export interface RepositoryLabel {
  name: string;
  description: string;
  color: string;
}

/**
 * Issue data as returned by GitHub API.
 */
export interface IssueData {
  number: number;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  labels: string[];
}

/**
 * Repository metadata.
 */
export interface RepositoryData {
  id: number;
  fullName: string;
  defaultBranch: string;
}

/**
 * Issue comment metadata.
 */
export interface IssueComment {
  id: number;
  body: string;
  author: string;
  createdAt: string;
}

export interface PullRequestContext {
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: string;
  url: string;
  headRefName: string;
  headSha: string;
  baseRefName: string;
  draft: boolean;
  mergeableState?: string;
  changedFiles?: number;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string | null;
}

export interface CheckRunContext {
  name: string;
  status: string;
  conclusion?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  detailsUrl?: string | null;
}

export interface RelatedIssueContext {
  number: number;
  title: string;
  state: 'open' | 'closed';
  relationship: 'mentioned' | 'referenced';
  url: string;
}

/**
 * Abstract GitHub read client for fetching repository and issue metadata.
 * Implementations: FakeGithubClient (tests/dev), real GitHub REST client (future milestones).
 */
export abstract class GithubClient {
  abstract getRepositoryLabels(
    owner: string,
    repo: string,
  ): Promise<RepositoryLabel[]>;

  abstract getIssue(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<IssueData>;

  abstract getRepository(owner: string, repo: string): Promise<RepositoryData>;

  abstract getIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<IssueComment[]>;

  abstract getLinkedPullRequests(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<PullRequestContext[]>;

  abstract getCheckRunsForRef(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<CheckRunContext[]>;

  abstract getRelatedIssues(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<RelatedIssueContext[]>;
}
