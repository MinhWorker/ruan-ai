export interface EnvironmentConfig {
  PORT: number;
  GITHUB_WEBHOOK_SECRET: string;
  PROVIDER_MODE: 'fake' | 'real';
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_INSTALLATION_ID?: string;
  GOOGLE_AI_STUDIO_API_KEY?: string;
  PRIMARY_MODEL_ID?: string;
  FALLBACK_MODEL_ID?: string;
}

export function validateConfig(
  env: Record<string, string | undefined>,
): EnvironmentConfig {
  const errors: string[] = [];

  const portStr = env.PORT ?? '3000';
  const port = parseInt(portStr, 10);
  if (isNaN(port)) {
    errors.push(`PORT must be a number, got: ${portStr}`);
  }

  const webhookSecret = env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    errors.push('GITHUB_WEBHOOK_SECRET is required and cannot be empty.');
  }

  const providerModeInput = env.PROVIDER_MODE ?? 'fake';
  if (providerModeInput !== 'fake' && providerModeInput !== 'real') {
    errors.push(
      `PROVIDER_MODE must be either "fake" or "real", got: ${providerModeInput}`,
    );
  }
  const providerMode = providerModeInput === 'real' ? 'real' : 'fake';

  if (providerMode === 'real') {
    if (!env.GITHUB_APP_ID)
      errors.push('GITHUB_APP_ID is required in real mode.');
    if (!env.GITHUB_APP_PRIVATE_KEY)
      errors.push('GITHUB_APP_PRIVATE_KEY is required in real mode.');
    if (!env.GOOGLE_AI_STUDIO_API_KEY)
      errors.push('GOOGLE_AI_STUDIO_API_KEY is required in real mode.');
    if (!env.PRIMARY_MODEL_ID)
      errors.push('PRIMARY_MODEL_ID is required in real mode.');
    if (!env.FALLBACK_MODEL_ID)
      errors.push('FALLBACK_MODEL_ID is required in real mode.');
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.join('\n')}`);
  }

  return {
    PORT: port,
    GITHUB_WEBHOOK_SECRET: webhookSecret!,
    PROVIDER_MODE: providerMode,
    GITHUB_APP_ID: env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_INSTALLATION_ID: env.GITHUB_INSTALLATION_ID,
    GOOGLE_AI_STUDIO_API_KEY: env.GOOGLE_AI_STUDIO_API_KEY,
    PRIMARY_MODEL_ID: env.PRIMARY_MODEL_ID,
    FALLBACK_MODEL_ID: env.FALLBACK_MODEL_ID,
  };
}
