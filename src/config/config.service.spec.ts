import { validateConfig } from './config.validation';
import { ConfigService } from './config.service';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ConfigValidation', () => {
  it('should validate and return config when required env vars are present', () => {
    const env = {
      PORT: '4000',
      GITHUB_WEBHOOK_SECRET: 'super-secret-key',
    };

    const config = validateConfig(env);
    expect(config.PORT).toBe(4000);
    expect(config.GITHUB_WEBHOOK_SECRET).toBe('super-secret-key');
    expect(config.PROVIDER_MODE).toBe('fake');
  });

  it('should validate and return config in real mode with all secrets', () => {
    const env = {
      PORT: '4000',
      GITHUB_WEBHOOK_SECRET: 'super-secret-key',
      PROVIDER_MODE: 'real',
      GITHUB_APP_ID: 'app-id',
      GITHUB_APP_PRIVATE_KEY: 'app-key',
      GOOGLE_AI_STUDIO_API_KEY: 'ai-key',
      PRIMARY_MODEL_ID: 'gemini-1.5-pro',
      FALLBACK_MODEL_ID: 'gemini-1.5-flash',
    };

    const config = validateConfig(env);
    expect(config.PROVIDER_MODE).toBe('real');
    expect(config.GITHUB_APP_ID).toBe('app-id');
  });

  it('should throw error in real mode if secrets are missing', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'super-secret-key',
      PROVIDER_MODE: 'real',
    };

    expect(() => validateConfig(env)).toThrow(
      'GITHUB_APP_ID is required in real mode.',
    );
  });

  it('should throw error when GITHUB_WEBHOOK_SECRET is missing', () => {
    const env = {
      PORT: '4000',
    };

    expect(() => validateConfig(env)).toThrow(
      'GITHUB_WEBHOOK_SECRET is required',
    );
  });

  it('should default port to 3000 if PORT is not provided', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'my-secret',
    };

    const config = validateConfig(env);
    expect(config.PORT).toBe(3000);
  });

  it('should throw error if PORT is not a valid number', () => {
    const env = {
      PORT: 'not-a-number',
      GITHUB_WEBHOOK_SECRET: 'my-secret',
    };

    expect(() => validateConfig(env)).toThrow('PORT must be a number');
  });

  it('should throw error if PROVIDER_MODE is unsupported', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'my-secret',
      PROVIDER_MODE: 'production',
    };

    expect(() => validateConfig(env)).toThrow(
      'PROVIDER_MODE must be either "fake" or "real"',
    );
  });

  it('should default AI_MODEL_TIMEOUT_MS to 120000', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'my-secret',
    };

    const config = validateConfig(env);
    expect(config.AI_MODEL_TIMEOUT_MS).toBe(120000);
  });

  it('should accept a custom AI_MODEL_TIMEOUT_MS', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'my-secret',
      AI_MODEL_TIMEOUT_MS: '60000',
    };

    const config = validateConfig(env);
    expect(config.AI_MODEL_TIMEOUT_MS).toBe(60000);
  });

  it('should throw error if AI_MODEL_TIMEOUT_MS is below 5000', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'my-secret',
      AI_MODEL_TIMEOUT_MS: '1000',
    };

    expect(() => validateConfig(env)).toThrow(
      'AI_MODEL_TIMEOUT_MS must be a number >= 5000',
    );
  });
});

describe('ConfigService', () => {
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();

  afterEach(() => {
    process.env = { ...originalEnv };
    process.chdir(originalCwd);
  });

  it('should load properties from process.env', () => {
    process.env.PORT = '8080';
    process.env.GITHUB_WEBHOOK_SECRET = 'service-secret';
    process.env.PROVIDER_MODE = 'real';
    process.env.GITHUB_APP_ID = 'app-id';
    process.env.GITHUB_APP_PRIVATE_KEY = 'app-key';
    process.env.GOOGLE_AI_STUDIO_API_KEY = 'ai-key';
    process.env.PRIMARY_MODEL_ID = 'model-1';
    process.env.FALLBACK_MODEL_ID = 'model-2';

    const service = new ConfigService();
    expect(service.port).toBe(8080);
    expect(service.githubWebhookSecret).toBe('service-secret');
    expect(service.providerMode).toBe('real');
    expect(service.githubAppId).toBe('app-id');
    expect(service.githubAppPrivateKey).toBe('app-key');
    expect(service.googleAiStudioApiKey).toBe('ai-key');
    expect(service.primaryModelId).toBe('model-1');
    expect(service.fallbackModelId).toBe('model-2');
  });

  it('should load properties from a local .env file', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ruan-ai-config-'));
    process.env = {};
    process.chdir(tempDir);
    writeFileSync(
      join(tempDir, '.env'),
      ['PORT=9090', 'GITHUB_WEBHOOK_SECRET=file-secret'].join('\n'),
    );

    try {
      const service = new ConfigService();

      expect(service.port).toBe(9090);
      expect(service.githubWebhookSecret).toBe('file-secret');
      expect(service.providerMode).toBe('fake');
    } finally {
      process.chdir(originalCwd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
