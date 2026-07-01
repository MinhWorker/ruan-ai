import { Injectable, Logger, Optional } from '@nestjs/common';
import { GithubWriter } from '../interfaces/github-writer.interface';
import { ConfigService } from '../../config/config.service';
import { TelemetryService } from '../../telemetry/services/telemetry.service';

interface OctokitConstructor {
  new (options: {
    authStrategy: unknown;
    auth: {
      appId: string;
      privateKey: string;
      installationId?: number;
    };
  }): GithubWriteRestClient;
}

interface GithubWriteRestClient {
  rest: {
    apps: {
      getRepoInstallation(params: {
        owner: string;
        repo: string;
      }): Promise<{ data: { id: number } }>;
    };
    issues: {
      addLabels(params: {
        owner: string;
        repo: string;
        issue_number: number;
        labels: string[];
      }): Promise<unknown>;
      listComments(params: {
        owner: string;
        repo: string;
        issue_number: number;
        per_page?: number;
        page?: number;
      }): Promise<{ data: GithubCommentResponse[] }>;
      updateComment(params: {
        owner: string;
        repo: string;
        comment_id: number;
        body: string;
      }): Promise<unknown>;
      createComment(params: {
        owner: string;
        repo: string;
        issue_number: number;
        body: string;
      }): Promise<unknown>;
    };
  };
}

interface GithubCommentResponse {
  id: number;
  body?: string | null;
}

@Injectable()
export class RealGithubWriter extends GithubWriter {
  private appOctokit?: GithubWriteRestClient;
  private readonly installationOctokitByKey = new Map<
    string,
    GithubWriteRestClient
  >();
  private readonly logger = new Logger(RealGithubWriter.name);

  constructor(
    private configService: ConfigService,
    @Optional()
    private readonly telemetryService?: TelemetryService,
  ) {
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

  private async getAppOctokit(): Promise<GithubWriteRestClient> {
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
  ): Promise<GithubWriteRestClient> {
    const installationId = this.configService.githubInstallationId;
    if (installationId) {
      return this.getCachedInstallationOctokit(
        `installation:${installationId}`,
        Number(installationId),
      );
    }

    const repositoryCacheKey = `repository:${owner}/${repo}`;
    const cached = this.installationOctokitByKey.get(repositoryCacheKey);
    if (cached) return cached;

    const appOcto = await this.getAppOctokit();
    const { data: installation } = await appOcto.rest.apps.getRepoInstallation({
      owner,
      repo,
    });

    return this.getCachedInstallationOctokit(
      repositoryCacheKey,
      installation.id,
    );
  }

  private async getCachedInstallationOctokit(
    cacheKey: string,
    installationId: number,
  ): Promise<GithubWriteRestClient> {
    const cached = this.installationOctokitByKey.get(cacheKey);
    if (cached) return cached;

    const { Octokit } = await this.loadOctokit();
    const { createAppAuth } = await this.loadAuthApp();
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.configService.githubAppId!,
        privateKey: this.configService.githubAppPrivateKey!,
        installationId,
      },
    });
    this.installationOctokitByKey.set(cacheKey, octokit);
    return octokit;
  }

  async applyLabels(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[],
  ): Promise<void> {
    if (!labels.length) return;

    try {
      const octokit = await this.getInstallationOctokit(owner, repo);
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels,
      });

      this.telemetryService?.recordEvent({
        type: 'github_write',
        severity: 'info',
        repositoryOwner: owner,
        repositoryName: repo,
        issueNumber,
        message: `Successfully applied labels to issue #${issueNumber}: ${labels.join(', ')}`,
        metadata: {
          action: 'apply_labels',
          labels,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.telemetryService?.recordEvent({
        type: 'github_write',
        severity: 'error',
        repositoryOwner: owner,
        repositoryName: repo,
        issueNumber,
        message: `Failed to apply labels to issue #${issueNumber}: ${errorMsg}`,
        metadata: {
          action: 'apply_labels',
          labels,
          error: errorMsg,
        },
      });
      throw error;
    }
  }

  async upsertComment(
    owner: string,
    repo: string,
    issueNumber: number,
    marker: string,
    body: string,
  ): Promise<void> {
    try {
      const octokit = await this.getInstallationOctokit(owner, repo);
      let existingComment: GithubCommentResponse | undefined;
      let page = 1;

      while (true) {
        const { data: comments } = await octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: issueNumber,
          per_page: 100,
          page,
        });

        const found = comments.find((c) => c.body?.includes(marker));
        if (found) {
          existingComment = found;
          break;
        }

        if (comments.length < 100) break;
        page++;
      }

      const finalBody = `${marker}\n${body}`;
      let action: 'create_comment' | 'update_comment' = 'create_comment';

      if (existingComment) {
        action = 'update_comment';
        await octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: existingComment.id,
          body: finalBody,
        });
      } else {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: issueNumber,
          body: finalBody,
        });
      }

      this.telemetryService?.recordEvent({
        type: 'github_write',
        severity: 'info',
        repositoryOwner: owner,
        repositoryName: repo,
        issueNumber,
        message: `Successfully upserted comment (${action}) on issue #${issueNumber}`,
        metadata: {
          action,
          marker,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.telemetryService?.recordEvent({
        type: 'github_write',
        severity: 'error',
        repositoryOwner: owner,
        repositoryName: repo,
        issueNumber,
        message: `Failed to upsert comment on issue #${issueNumber}: ${errorMsg}`,
        metadata: {
          action: 'upsert_comment',
          marker,
          error: errorMsg,
        },
      });
      throw error;
    }
  }
}
