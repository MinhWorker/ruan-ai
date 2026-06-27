import { Injectable } from '@nestjs/common';
import { ModelAvailabilityStatus } from '../interfaces/model-availability.interface';

@Injectable()
export class ModelAvailabilityService {
  private configuredModelId = 'fake-model-local';
  private forceUnavailable = false;
  private forceReason?: string;
  private fallbackModelId = 'fake-model-local-fallback';

  validate(): ModelAvailabilityStatus {
    if (this.forceUnavailable) {
      return {
        available: false,
        status: 'unavailable',
        modelId: this.configuredModelId,
        checkedAt: new Date(),
        reason: this.forceReason || 'Model is currently overloaded',
        fallbackModelId: this.fallbackModelId,
      };
    }

    return {
      available: true,
      status: 'available',
      modelId: this.configuredModelId,
      checkedAt: new Date(),
    };
  }

  // Helper for tests/ops to simulate degraded state
  public setUnavailableState(unavailable: boolean, reason?: string): void {
    this.forceUnavailable = unavailable;
    this.forceReason = reason;
  }

  public setConfiguredModelId(modelId: string): void {
    this.configuredModelId = modelId;
  }

  public setFallbackModelId(modelId: string): void {
    this.fallbackModelId = modelId;
  }
}
