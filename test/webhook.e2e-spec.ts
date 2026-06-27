import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import * as crypto from 'crypto';

describe('GithubWebhookController (e2e)', () => {
  let app: INestApplication<App>;
  const secret = 'e2e-secret-key';

  beforeAll(async () => {
    process.env.GITHUB_WEBHOOK_SECRET = secret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function getSignature(payload: any): string {
    const raw = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(raw);
    return `sha256=${hmac.digest('hex')}`;
  }

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

  it('POST /github/webhooks accepts valid signatures for supported events with 202', () => {
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
      });
  });

  it('POST /github/webhooks returns duplicate status for duplicate X-GitHub-Delivery', async () => {
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
    const deliveryId = 'delivery-id-e2e-duplicate';

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
      });
  });

  it('POST /github/webhooks ignores unsupported events and returns 202', () => {
    const payload = {
      action: 'created',
      repository: {
        id: 123,
        name: 'ruan-ai',
        full_name: 'MinhWorker/ruan-ai',
        owner: { login: 'MinhWorker' },
      },
    };
    const sig = getSignature(payload);

    return request(app.getHttpServer())
      .post('/github/webhooks')
      .set('x-hub-signature-256', sig)
      .set('x-github-event', 'star')
      .set('x-github-delivery', 'delivery-id-e2e-unsupported')
      .send(payload)
      .expect(202)
      .expect((res) => {
        const body = res.body as Record<string, unknown>;
        expect(body.status).toBe('ignored');
        expect(body.reason).toBeDefined();
      });
  });

  it('POST /github/webhooks accepts /status command with 202', () => {
    const payload = {
      action: 'created',
      issue: { number: 10, title: 'Test', body: 'Test' },
      comment: { id: 201, body: '/status please' },
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
      .set('x-github-delivery', 'delivery-id-e2e-status')
      .send(payload)
      .expect(202)
      .expect((res) => {
        const body = res.body as Record<string, unknown>;
        expect(body.status).toBe('accepted');
      });
  });

  it('POST /github/webhooks accepts /blocker command with 202', () => {
    const payload = {
      action: 'created',
      issue: { number: 10, title: 'Test', body: 'Test' },
      comment: { id: 202, body: '/blocker check' },
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
      .set('x-github-delivery', 'delivery-id-e2e-blocker')
      .send(payload)
      .expect(202)
      .expect((res) => {
        const body = res.body as Record<string, unknown>;
        expect(body.status).toBe('accepted');
      });
  });

  it('POST /github/webhooks accepts /stop command with 202', () => {
    const payload = {
      action: 'created',
      issue: { number: 10, title: 'Test', body: 'Test' },
      comment: { id: 203, body: '/stop now' },
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
      .set('x-github-delivery', 'delivery-id-e2e-stop')
      .send(payload)
      .expect(202)
      .expect((res) => {
        const body = res.body as Record<string, unknown>;
        expect(body.status).toBe('accepted');
      });
  });
});
