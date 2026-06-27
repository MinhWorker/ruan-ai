import { validateConfig } from './config.validation';
import { ConfigService } from './config.service';

describe('ConfigValidation', () => {
  it('should validate and return config when required env vars are present', () => {
    const env = {
      PORT: '4000',
      GITHUB_WEBHOOK_SECRET: 'super-secret-key',
    };

    const config = validateConfig(env);
    expect(config.PORT).toBe(4000);
    expect(config.GITHUB_WEBHOOK_SECRET).toBe('super-secret-key');
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
});

describe('ConfigService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should load properties from process.env', () => {
    process.env.PORT = '8080';
    process.env.GITHUB_WEBHOOK_SECRET = 'service-secret';

    const service = new ConfigService();
    expect(service.port).toBe(8080);
    expect(service.githubWebhookSecret).toBe('service-secret');
  });
});
