import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ModelAvailabilityStatus } from '../interfaces/model-availability.interface';
import { AiClient } from '../interfaces/ai-client.interface';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class ModelAvailabilityService {
  private forceUnavailable = false;
  private forceReason?: string;
  private fallbackAvailable = true;

  constructor(
    @Inject(forwardRef(() => AiClient)) private aiClient: AiClient,
    private configService: ConfigService,
  ) {}

  async validate(): Promise<ModelAvailabilityStatus> {
    const primaryModelId = this.configService.primaryModelId || 'fake-primary';
    const fallbackModelId =
      this.configService.fallbackModelId || 'fake-fallback';

    if (this.forceUnavailable) {
      return {
        available: false,
        status: 'unavailable',
        modelId: primaryModelId,
        checkedAt: new Date(),
        reason: this.forceReason || 'Model is currently overloaded',
        fallbackModelId: fallbackModelId,
      };
    }

    const primaryAvailable = await this.aiClient.checkModel(primaryModelId);

    if (!primaryAvailable) {
      const fallbackAvail = await this.aiClient.checkModel(fallbackModelId);
      return {
        available: fallbackAvail,
        status: fallbackAvail ? 'degraded' : 'unavailable',
        modelId: fallbackModelId,
        checkedAt: new Date(),
        reason: 'Primary model unavailable',
        fallbackModelId,
      };
    }

    return {
      available: true,
      status: 'available',
      modelId: primaryModelId,
      checkedAt: new Date(),
    };
  }

  // Helper for tests/ops to simulate degraded state
  public setUnavailableState(unavailable: boolean, reason?: string): void {
    this.forceUnavailable = unavailable;
    this.forceReason = reason;
  }
}
