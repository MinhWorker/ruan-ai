import { validateConfig } from './config.validation';

describe('Config Validation', () => {
  it('should pass in fake mode without real credentials', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
      PROVIDER_MODE: 'fake',
    };

    const config = validateConfig(env);
    expect(config.PROVIDER_MODE).toBe('fake');
    expect(config.GITHUB_WEBHOOK_SECRET).toBe('secret');
  });

  it('should fail fast in real mode if required credentials are missing', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
      PROVIDER_MODE: 'real',
    };

    expect(() => validateConfig(env)).toThrow(
      /GITHUB_APP_ID is required in real mode/,
    );
    expect(() => validateConfig(env)).toThrow(
      /GITHUB_APP_PRIVATE_KEY is required in real mode/,
    );
    expect(() => validateConfig(env)).toThrow(
      /GOOGLE_AI_STUDIO_API_KEY is required in real mode/,
    );
    expect(() => validateConfig(env)).toThrow(
      /PRIMARY_MODEL_ID is required in real mode/,
    );
    expect(() => validateConfig(env)).toThrow(
      /FALLBACK_MODEL_ID is required in real mode/,
    );
  });

  it('should pass in real mode if all required credentials are provided', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
      PROVIDER_MODE: 'real',
      GITHUB_APP_ID: 'app-id',
      GITHUB_APP_PRIVATE_KEY: 'private-key',
      GOOGLE_AI_STUDIO_API_KEY: 'api-key',
      PRIMARY_MODEL_ID: 'primary',
      FALLBACK_MODEL_ID: 'fallback',
    };

    const config = validateConfig(env);
    expect(config.PROVIDER_MODE).toBe('real');
  });
});
