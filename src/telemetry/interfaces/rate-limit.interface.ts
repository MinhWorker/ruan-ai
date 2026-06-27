export interface RateLimitSnapshot {
  aiModel: {
    configuredProfile: string;
    requestCount: number;
    estimatedTokens: number;
    lastError?: string;
    resetAt?: Date;
    degradedState: boolean;
  };
  githubApi: {
    requestCount: number;
    lastError?: string;
    resetAt?: Date;
    degradedState: boolean;
  };
}
