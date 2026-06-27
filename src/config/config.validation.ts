export interface EnvironmentConfig {
  PORT: number;
  GITHUB_WEBHOOK_SECRET: string;
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

  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.join('\n')}`);
  }

  return {
    PORT: port,
    GITHUB_WEBHOOK_SECRET: webhookSecret!,
  };
}
