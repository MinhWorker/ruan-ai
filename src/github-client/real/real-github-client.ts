import { Injectable, Logger } from '@nestjs/common';
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
import { ConfigService } from '../../config/config.service';

interface OctokitConstructor {
  new (options: {
    authStrategy: unknown;
    auth: {
      appId: string;
      privateKey: string;
      installationId?: number;
    };
  }): GithubRestClient;
}

interface GithubRestClient {
  rest: {
    apps: {
      getRepoInstallation(params: {
        owner: string;
        repo: string;
      }): Promise<{ data: { id: number } }>;
    };
    issues: {
      listLabelsForRepo(params: {
        owner: string;
        repo: string;
        per_page?: number;
        page?: number;
      }): Promise<{ data: GithubLabelResponse[] }>;
      get(params: {
        owner: string;
        repo: string;
        issue_number: number;
      }): Promise<{ data: GithubIssueResponse }>;
      listComments(params: {
        owner: string;
        repo: string;
        issue_number: number;
        per_page?: number;
        page?: number;
      }): Promise<{ data: GithubCommentResponse[] }>;
      listEventsForTimeline(params: {
        owner: string;
        repo: string;
        issue_number: number;
        per_page?: number;
        page?: number;
      }): Promise<{ data: GithubTimelineEventResponse[] }>;
    };
    repos: {
      get(params: {
        owner: string;
        repo: string;
      }): Promise<{ data: GithubRepositoryResponse }>;
    };
    pulls: {
      get(params: {
        owner: string;
        repo: string;
        pull_number: number;
      }): Promise<{ data: GithubPullRequestResponse }>;
    };
    checks: {
      listForRef(params: {
        owner: string;
        repo: string;
        ref: string;
        per_page?: number;
        page?: number;
      }): Promise<{ data: { check_runs: GithubCheckRunResponse[] } }>;
    };
  };
}

interface GithubLabelResponse {
  name: string;
  description?: string | null;
  color: string;
}

interface GithubIssueResponse {
  number: number;
  title: string;
  body?: string | null;
  user?: { login?: string | null } | null;
  created_at: string;
  labels: Array<string | { name?: string | null }>;
  state?: string;
  html_url?: string;
  pull_request?: unknown;
}

interface GithubRepositoryResponse {
  id: number;
  full_name: string;
  default_branch: string;
}

interface GithubCommentResponse {
  id: number;
  body?: string | null;
  user?: { login?: string | null } | null;
  created_at: string;
}

interface GithubTimelineEventResponse {
  event?: string;
  source?: {
    issue?: {
      number?: number;
      pull_request?: unknown;
    };
  };
}

interface GithubPullRequestResponse {
  number: number;
  title: string;
  state: string;
  user?: { login?: string | null } | null;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  draft?: boolean;
  mergeable_state?: string | null;
  changed_files?: number;
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
}

interface GithubCheckRunResponse {
  name: string;
  status: string;
  conclusion?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  details_url?: string | null;
  html_url?: string | null;
}

const RELATED_ISSUE_REFERENCE_PATTERN = /(?:^|[^\w/])#(\d+)\b/g;
const MAX_RELATED_ISSUE_LOOKUPS = 10;

@Injectable()
export class RealGithubClient extends GithubClient {
  private appOctokit?: GithubRestClient;
  private readonly logger = new Logger(RealGithubClient.name);

  constructor(private configService: ConfigService) {
    super();
  }

  // Exposed for testing
  protected async loadOctokit(): Promise<{ Octokit: OctokitConstructor }> {
    const module = await import('octokit');
    return { Octokit: module.Octokit as unknown as OctokitConstructor };
  }

  protected async loadAuthApp(): Promise<{ createAppAuth: unknown }> {
    const module = await import('@octokit/auth-app');
    return { createAppAuth: module.createAppAuth };
  }

  private async getAppOctokit(): Promise<GithubRestClient> {
    if (this.appOctokit) return this.appOctokit;
    const { Octokit } = await this.loadOctokit();
    const { createAppAuth } = await this.loadAuthApp();
    this.appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.configService.githubAppId!,
        privateKey: this.configService.githubAppPrivateKey!,
      },
    });
    return this.appOctokit;
  }

  private async getInstallationOctokit(
    owner: string,
    repo: string,
  ): Promise<GithubRestClient> {
    const { Octokit } = await this.loadOctokit();
    const { createAppAuth } = await this.loadAuthApp();
    const installationId = this.configService.githubInstallationId;
    if (installationId) {
      return new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: this.configService.githubAppId!,
          privateKey: this.configService.githubAppPrivateKey!,
          installationId: Number(installationId),
        },
      });
    }

    const appOcto = await this.getAppOctokit();
    const { data: installation } = await appOcto.rest.apps.getRepoInstallation({
      owner,
      repo,
    });

    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.configService.githubAppId!,
        privateKey: this.configService.githubAppPrivateKey!,
        installationId: installation.id,
      },
    });
  }

  async getRepositoryLabels(
    owner: string,
    repo: string,
  ): Promise<RepositoryLabel[]> {
    const octokit = await this.getInstallationOctokit(owner, repo);
    const allLabels: GithubLabelResponse[] = [];
    let page = 1;
    while (true) {
      const { data } = await octokit.rest.issues.listLabelsForRepo({
        owner,
        repo,
        per_page: 100,
        page,
      });
      allLabels.push(...data);
      if (data.length < 100) break;
      page++;
    }
    return allLabels.map((label: GithubLabelResponse) => ({
      name: label.name,
      description: label.description ?? '',
      color: label.color,
    }));
  }

  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<IssueData> {
    const octokit = await this.getInstallationOctokit(owner, repo);
    const { data } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    const labels = data.labels.map((l) =>
      typeof l === 'string' ? l : l.name!,
    );

    return {
      number: data.number,
      title: data.title,
      body: data.body ?? '',
      author: data.user?.login ?? '',
      createdAt: data.created_at,
      labels,
    };
  }

  async getRepository(owner: string, repo: string): Promise<RepositoryData> {
    const octokit = await this.getInstallationOctokit(owner, repo);
    const { data } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    return {
      id: data.id,
      fullName: data.full_name,
      defaultBranch: data.default_branch,
    };
  }

  async getIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<IssueComment[]> {
    const octokit = await this.getInstallationOctokit(owner, repo);
    const allComments: GithubCommentResponse[] = [];
    let page = 1;
    while (true) {
      const { data } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
        page,
      });
      allComments.push(...data);
      if (data.length < 100) break;
      page++;
    }

    return allComments.map((comment: GithubCommentResponse) => ({
      id: comment.id,
      body: comment.body ?? '',
      author: comment.user?.login ?? '',
      createdAt: comment.created_at,
    }));
  }

  async getLinkedPullRequests(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<PullRequestContext[]> {
    const octokit = await this.getInstallationOctokit(owner, repo);
    const pullRequestNumbers = new Set<number>();
    let page = 1;

    while (true) {
      const { data } = await octokit.rest.issues.listEventsForTimeline({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
        page,
      });

      for (const event of data) {
        const sourceIssue = event.source?.issue;
        if (sourceIssue?.pull_request && sourceIssue.number) {
          pullRequestNumbers.add(sourceIssue.number);
        }
      }

      if (data.length < 100) break;
      page++;
    }

    const pullRequests: PullRequestContext[] = [];
    for (const pullNumber of pullRequestNumbers) {
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });
      pullRequests.push(mapPullRequest(data));
    }

    return pullRequests.sort((a, b) => a.number - b.number);
  }

  async getCheckRunsForRef(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<CheckRunContext[]> {
    const octokit = await this.getInstallationOctokit(owner, repo);
    const checkRuns: GithubCheckRunResponse[] = [];
    let page = 1;

    while (true) {
      const { data } = await octokit.rest.checks.listForRef({
        owner,
        repo,
        ref,
        per_page: 100,
        page,
      });
      checkRuns.push(...data.check_runs);
      if (data.check_runs.length < 100) break;
      page++;
    }

    return checkRuns.map((run) => ({
      name: run.name,
      status: run.status,
      conclusion: run.conclusion ?? null,
      startedAt: run.started_at ?? null,
      completedAt: run.completed_at ?? null,
      detailsUrl: run.details_url ?? run.html_url ?? null,
    }));
  }

  async getRelatedIssues(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<RelatedIssueContext[]> {
    const [issue, comments] = await Promise.all([
      this.getIssue(owner, repo, issueNumber),
      this.getIssueComments(owner, repo, issueNumber),
    ]);

    const mentionedIssueNumbers = extractIssueReferences([
      issue.body,
      ...comments.map((comment) => comment.body),
    ]).filter((number) => number !== issueNumber);

    const octokit = await this.getInstallationOctokit(owner, repo);
    const relatedIssues: RelatedIssueContext[] = [];

    for (const relatedIssueNumber of mentionedIssueNumbers.slice(
      0,
      MAX_RELATED_ISSUE_LOOKUPS,
    )) {
      try {
        const { data } = await octokit.rest.issues.get({
          owner,
          repo,
          issue_number: relatedIssueNumber,
        });
        if (data.pull_request) {
          continue;
        }
        relatedIssues.push({
          number: data.number,
          title: data.title,
          state: data.state === 'closed' ? 'closed' : 'open',
          relationship: 'mentioned',
          url: data.html_url ?? '',
        });
      } catch (error) {
        this.logger.debug(
          `Skipping related issue ${owner}/${repo}#${relatedIssueNumber}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return relatedIssues;
  }
}

function mapPullRequest(data: GithubPullRequestResponse): PullRequestContext {
  return {
    number: data.number,
    title: data.title,
    state: data.state === 'closed' ? 'closed' : 'open',
    author: data.user?.login ?? '',
    url: data.html_url,
    headRefName: data.head.ref,
    headSha: data.head.sha,
    baseRefName: data.base.ref,
    draft: data.draft ?? false,
    mergeableState: data.mergeable_state ?? undefined,
    changedFiles: data.changed_files,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    mergedAt: data.merged_at ?? null,
  };
}

function extractIssueReferences(texts: string[]): number[] {
  const references = new Set<number>();
  for (const text of texts) {
    for (const match of text.matchAll(RELATED_ISSUE_REFERENCE_PATTERN)) {
      const parsed = Number(match[1]);
      if (Number.isInteger(parsed) && parsed > 0) {
        references.add(parsed);
      }
    }
  }
  return [...references];
}
