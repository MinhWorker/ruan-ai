import { Injectable } from '@nestjs/common';
import { config as loadDotEnv } from 'dotenv';
import { EnvironmentConfig, validateConfig } from './config.validation';

@Injectable()
export class ConfigService {
  private readonly config: EnvironmentConfig;

  constructor() {
    loadDotEnv({ quiet: true });
    this.config = validateConfig(process.env);
  }

  get port(): number {
    return this.config.PORT;
  }

  get githubWebhookSecret(): string {
    return this.config.GITHUB_WEBHOOK_SECRET;
  }

  get providerMode(): 'fake' | 'real' {
    return this.config.PROVIDER_MODE;
  }

  get githubAppId(): string | undefined {
    return this.config.GITHUB_APP_ID;
  }

  get githubAppPrivateKey(): string | undefined {
    return this.config.GITHUB_APP_PRIVATE_KEY;
  }

  get githubInstallationId(): string | undefined {
    return this.config.GITHUB_INSTALLATION_ID;
  }

  get googleAiStudioApiKey(): string | undefined {
    return this.config.GOOGLE_AI_STUDIO_API_KEY;
  }

  get primaryModelId(): string | undefined {
    return this.config.PRIMARY_MODEL_ID;
  }

  get fallbackModelId(): string | undefined {
    return this.config.FALLBACK_MODEL_ID;
  }

  get jobExecutionMode(): 'inline' | 'queued' {
    return this.config.JOB_EXECUTION_MODE;
  }
}
