import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { GithubClient } from '../src/github-client/interfaces/github-client.interface';
import { GithubWriter } from '../src/github-writer/interfaces/github-writer.interface';
import { AiClient } from '../src/ai/interfaces/ai-client.interface';

const runLiveIntegration = process.env.RUN_LIVE_INTEGRATION === 'true';

(runLiveIntegration ? describe : describe.skip)(
  'Live Integration Tests (e2e)',
  () => {
    let app: INestApplication;
    let githubClient: GithubClient;
    let githubWriter: GithubWriter;
    let aiClient: AiClient;

    beforeAll(async () => {
      // Validate required env vars
      const requiredVars = [
        'PROVIDER_MODE',
        'GITHUB_WEBHOOK_SECRET',
        'GITHUB_APP_ID',
        'GITHUB_APP_PRIVATE_KEY',
        'GITHUB_LIVE_OWNER',
        'GITHUB_LIVE_REPO',
        'GOOGLE_AI_STUDIO_API_KEY',
        'PRIMARY_MODEL_ID',
        'FALLBACK_MODEL_ID',
      ];

      for (const v of requiredVars) {
        if (!process.env[v]) {
          throw new Error(`Missing required env var for live tests: ${v}`);
        }
      }

      if (process.env.PROVIDER_MODE !== 'real') {
        throw new Error('PROVIDER_MODE must be set to "real" for live tests');
      }

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      githubClient = app.get<GithubClient>(GithubClient);
      githubWriter = app.get<GithubWriter>(GithubWriter);
      aiClient = app.get<AiClient>(AiClient);
    });

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    describe('GitHub Provider', () => {
      it('can read repository metadata via app installation auth', async () => {
        const owner = process.env.GITHUB_LIVE_OWNER!;
        const repo = process.env.GITHUB_LIVE_REPO!;
        const repoData = await githubClient.getRepository(owner, repo);

        expect(repoData).toBeDefined();
        expect(repoData.fullName.toLowerCase()).toBe(
          `${owner}/${repo}`.toLowerCase(),
        );
      });

      it('can read labels and comments against a configured test repo', async () => {
        const owner = process.env.GITHUB_LIVE_OWNER!;
        const repo = process.env.GITHUB_LIVE_REPO!;

        const labels = await githubClient.getRepositoryLabels(owner, repo);
        expect(Array.isArray(labels)).toBe(true);

        // Attempt to read issue 1 (assuming it exists, or just verify array returned)
        try {
          const comments = await githubClient.getIssueComments(owner, repo, 1);
          expect(Array.isArray(comments)).toBe(true);
        } catch (err: unknown) {
          if (
            err &&
            typeof err === 'object' &&
            'status' in err &&
            (err as { status?: number }).status === 404
          ) {
            // If issue #1 doesn't exist, we skip rather than fail
            console.warn(
              'Issue #1 not found in test repo, skipping comment read check',
            );
          } else {
            throw err;
          }
        }
      });
    });

    describe('Google AI Provider', () => {
      it('can check availability of primary and fallback models', async () => {
        const primaryId = process.env.PRIMARY_MODEL_ID!;
        const fallbackId = process.env.FALLBACK_MODEL_ID!;

        const primaryOk = await aiClient.checkModel(primaryId);
        expect(primaryOk).toBe(true);

        const fallbackOk = await aiClient.checkModel(fallbackId);
        expect(fallbackOk).toBe(true);
      });
    });

    describe('Live Write Tests', () => {
      const runLiveWrites = process.env.RUN_LIVE_WRITE_TESTS === 'true';

      (runLiveWrites ? it : it.skip)(
        'can upsert comment and add label',
        async () => {
          const owner = process.env.GITHUB_LIVE_OWNER!;
          const repo = process.env.GITHUB_LIVE_REPO!;
          const issueNumber = Number(process.env.GITHUB_LIVE_ISSUE_NUMBER);
          const label = process.env.GITHUB_LIVE_LABEL;

          if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
            throw new Error(
              'GITHUB_LIVE_ISSUE_NUMBER must be set to a positive integer when RUN_LIVE_WRITE_TESTS=true',
            );
          }
          if (!label) {
            throw new Error(
              'GITHUB_LIVE_LABEL must be set to an existing label when RUN_LIVE_WRITE_TESTS=true',
            );
          }

          await githubWriter.upsertComment(
            owner,
            repo,
            issueNumber,
            '<!-- test-marker -->',
            'Test comment from live integration',
          );
          await githubWriter.applyLabels(owner, repo, issueNumber, [label]);

          const comments = await githubClient.getIssueComments(
            owner,
            repo,
            issueNumber,
          );
          const testComment = comments.find((c) =>
            c.body.includes('<!-- test-marker -->'),
          );
          expect(testComment).toBeDefined();
        },
      );
    });
  },
);
