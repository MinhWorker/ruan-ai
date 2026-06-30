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
    expect(config.JOB_EXECUTION_MODE).toBe('queued'); // default
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

  it('should accept inline execution mode', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
      JOB_EXECUTION_MODE: 'inline',
    };

    const config = validateConfig(env);
    expect(config.JOB_EXECUTION_MODE).toBe('inline');
  });

  it('should default bot mention name', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
    };

    const config = validateConfig(env);
    expect(config.BOT_MENTION_NAME).toBe('ruangm-ai');
  });

  it('should accept custom bot mention name', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
      BOT_MENTION_NAME: 'custom-bot',
    };

    const config = validateConfig(env);
    expect(config.BOT_MENTION_NAME).toBe('custom-bot');
  });

  it('should normalize leading @ in bot mention name', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
      BOT_MENTION_NAME: '@custom-bot',
    };

    const config = validateConfig(env);
    expect(config.BOT_MENTION_NAME).toBe('custom-bot');
  });

  it('should fail if bot mention name is blank', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
      BOT_MENTION_NAME: '   ',
    };

    expect(() => validateConfig(env)).toThrow(
      /BOT_MENTION_NAME must be a non-empty mention name/,
    );
  });

  it('should fail if execution mode is invalid', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
      JOB_EXECUTION_MODE: 'invalid-mode',
    };

    expect(() => validateConfig(env)).toThrow(
      /JOB_EXECUTION_MODE must be either "inline" or "queued"/,
    );
  });

  it('should validate job storage mode and default to memory', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
    };
    const config = validateConfig(env);
    expect(config.JOB_STORAGE_MODE).toBe('memory');
  });

  it('should allow JOB_STORAGE_MODE=postgres and require DATABASE_URL', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
      JOB_STORAGE_MODE: 'postgres',
    };
    expect(() => validateConfig(env)).toThrow(
      /DATABASE_URL is required when JOB_STORAGE_MODE is "postgres"/,
    );

    const envWithDb = {
      ...env,
      DATABASE_URL: 'postgresql://localhost:5432/db',
    };
    const config = validateConfig(envWithDb);
    expect(config.JOB_STORAGE_MODE).toBe('postgres');
    expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/db');
  });

  it('should fail if JOB_STORAGE_MODE is invalid', () => {
    const env = {
      GITHUB_WEBHOOK_SECRET: 'secret',
      JOB_STORAGE_MODE: 'invalid',
    };
    expect(() => validateConfig(env)).toThrow(
      /JOB_STORAGE_MODE must be either "memory" or "postgres"/,
    );
  });
});
