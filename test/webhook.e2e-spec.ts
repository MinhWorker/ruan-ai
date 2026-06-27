import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import * as crypto from 'crypto';

describe('GithubWebhookController (e2e)', () => {
  const secret = 'e2e-secret-key';

  function getSignature(payload: any): string {
    const raw = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(raw);
    return `sha256=${hmac.digest('hex')}`;
  }

  describe('Queued Mode (default)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      process.env.GITHUB_WEBHOOK_SECRET = secret;
      process.env.JOB_EXECUTION_MODE = 'queued';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication({ rawBody: true });
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('POST /github/webhooks rejects unsigned requests with 401', () => {
      return request(app.getHttpServer())
        .post('/github/webhooks')
        .send({ action: 'opened' })
        .expect(401);
    });

    it('POST /github/webhooks rejects invalid signatures with 401', () => {
      return request(app.getHttpServer())
        .post('/github/webhooks')
        .set('x-hub-signature-256', 'sha256=invalid-signature-hash')
        .send({ action: 'opened' })
        .expect(401);
    });

    it('POST /github/webhooks accepts valid signatures for supported events with 202 and returns queued mode', () => {
      const payload = {
        action: 'opened',
        issue: { number: 10, title: 'Test', body: 'Test' },
        repository: {
          id: 123,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'tester', id: 4 },
      };
      const sig = getSignature(payload);

      return request(app.getHttpServer())
        .post('/github/webhooks')
        .set('x-hub-signature-256', sig)
        .set('x-github-event', 'issues')
        .set('x-github-delivery', 'delivery-id-e2e-1')
        .send(payload)
        .expect(202)
        .expect((res) => {
          const body = res.body as Record<string, unknown>;
          expect(body.status).toBe('accepted');
          expect(body.jobId).toBeDefined();
          expect(body.execution).toEqual({ mode: 'queued' });
        });
    });
  });

  describe('Inline Mode', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      process.env.GITHUB_WEBHOOK_SECRET = secret;
      process.env.JOB_EXECUTION_MODE = 'inline';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication({ rawBody: true });
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('signed issues.opened webhook in inline mode executes the fake triage workflow', () => {
      const payload = {
        action: 'opened',
        issue: { number: 10, title: 'Test', body: 'Test' },
        repository: {
          id: 123,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'tester', id: 4 },
      };
      const sig = getSignature(payload);

      return request(app.getHttpServer())
        .post('/github/webhooks')
        .set('x-hub-signature-256', sig)
        .set('x-github-event', 'issues')
        .set('x-github-delivery', 'delivery-id-e2e-inline-1')
        .send(payload)
        .expect(202)
        .expect((res) => {
          const body = res.body as Record<string, unknown>;
          expect(body.status).toBe('accepted');
          expect(body.jobId).toBeDefined();
          expect(body.execution).toEqual({ mode: 'inline', success: true });
        });
    });

    it('duplicate delivery in inline mode does not execute twice', async () => {
      const payload = {
        action: 'opened',
        issue: { number: 11, title: 'Test', body: 'Test' },
        repository: {
          id: 123,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'tester', id: 4 },
      };
      const sig = getSignature(payload);
      const deliveryId = 'delivery-id-e2e-inline-duplicate';

      let jobId: string | undefined;
      await request(app.getHttpServer())
        .post('/github/webhooks')
        .set('x-hub-signature-256', sig)
        .set('x-github-event', 'issues')
        .set('x-github-delivery', deliveryId)
        .send(payload)
        .expect(202)
        .then((res) => {
          const body = res.body as Record<string, unknown>;
          jobId = body.jobId as string;
        });

      expect(jobId).toBeDefined();

      await request(app.getHttpServer())
        .post('/github/webhooks')
        .set('x-hub-signature-256', sig)
        .set('x-github-event', 'issues')
        .set('x-github-delivery', deliveryId)
        .send(payload)
        .expect(202)
        .expect((res) => {
          const body = res.body as Record<string, unknown>;
          expect(body.status).toBe('duplicate');
          expect(body.jobId).toBe(jobId);
          expect(body.execution).toBeUndefined();
        });
    });

    it('issue_comment /plan in inline mode executes the fake workflow path', () => {
      const payload = {
        action: 'created',
        issue: { number: 12, title: 'Test', body: 'Test' },
        comment: { id: 301, body: '/plan' },
        repository: {
          id: 123,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'tester', id: 4 },
      };
      const sig = getSignature(payload);

      return request(app.getHttpServer())
        .post('/github/webhooks')
        .set('x-hub-signature-256', sig)
        .set('x-github-event', 'issue_comment')
        .set('x-github-delivery', 'delivery-id-e2e-inline-plan')
        .send(payload)
        .expect(202)
        .expect((res) => {
          const body = res.body as Record<string, unknown>;
          expect(body.status).toBe('accepted');
          expect(body.execution).toEqual({ mode: 'inline', success: true });
        });
    });

    it('issue_comment /status in inline mode executes the fake workflow path', () => {
      const payload = {
        action: 'created',
        issue: { number: 13, title: 'Test', body: 'Test' },
        comment: { id: 302, body: '/status' },
        repository: {
          id: 123,
          name: 'ruan-ai',
          full_name: 'MinhWorker/ruan-ai',
          owner: { login: 'MinhWorker' },
        },
        sender: { login: 'tester', id: 4 },
      };
      const sig = getSignature(payload);

      return request(app.getHttpServer())
        .post('/github/webhooks')
        .set('x-hub-signature-256', sig)
        .set('x-github-event', 'issue_comment')
        .set('x-github-delivery', 'delivery-id-e2e-inline-status')
        .send(payload)
        .expect(202)
        .expect((res) => {
          const body = res.body as Record<string, unknown>;
          expect(body.status).toBe('accepted');
          expect(body.execution).toEqual({ mode: 'inline', success: true });
        });
    });
  });
});
