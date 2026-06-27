import { Injectable, Logger } from '@nestjs/common';
import {
  GithubClient,
  RepositoryLabel,
  IssueData,
  RepositoryData,
  IssueComment,
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
    };
    repos: {
      get(params: {
        owner: string;
        repo: string;
      }): Promise<{ data: GithubRepositoryResponse }>;
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
}
