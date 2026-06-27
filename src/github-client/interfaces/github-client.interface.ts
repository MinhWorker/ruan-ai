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
}
