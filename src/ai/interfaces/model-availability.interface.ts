export interface ModelAvailabilityStatus {
  available: boolean;
  status: 'available' | 'unavailable' | 'unknown';
  modelId: string;
  checkedAt: Date;
  reason?: string;
  fallbackModelId?: string;
}
