export interface ModelAvailabilityStatus {
  available: boolean;
  status: 'available' | 'unavailable' | 'unknown' | 'degraded';
  modelId: string;
  checkedAt: Date;
  reason?: string;
  fallbackModelId?: string;
}
