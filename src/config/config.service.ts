import { Injectable } from '@nestjs/common';
import { EnvironmentConfig, validateConfig } from './config.validation';

@Injectable()
export class ConfigService {
  private readonly config: EnvironmentConfig;

  constructor() {
    this.config = validateConfig(process.env);
  }

  get port(): number {
    return this.config.PORT;
  }

  get githubWebhookSecret(): string {
    return this.config.GITHUB_WEBHOOK_SECRET;
  }
}
