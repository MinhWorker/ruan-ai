export type ProviderFamily = 'google-ai-studio' | 'google-cloud-agent-platform';

export interface SecretReference {
  secretVersionName: string;
}

export interface AiStudioConfig {
  apiKeySecretRef: SecretReference;
}

export interface GoogleCloudAgentPlatformConfig {
  projectId: string;
  location: string;
  serviceAccountKeySecretRef?: SecretReference;
}

export interface ProviderConfigRecord {
  id: string;
  installationId: string;
  repositoryId?: string;
  aiStudioConfig?: AiStudioConfig;
  googleCloudAgentPlatformConfig?: GoogleCloudAgentPlatformConfig;
  preferredProvider?: ProviderFamily;
}

export interface ResolvedAiStudioConfig {
  providerFamily: 'google-ai-studio';
  apiKeySecretRef?: SecretReference;
  rawApiKey?: string;
}

export interface ResolvedGoogleCloudAgentPlatformConfig {
  providerFamily: 'google-cloud-agent-platform';
  projectId: string;
  location: string;
  serviceAccountKeySecretRef?: SecretReference;
}

export type ResolvedProviderConfig =
  | ResolvedAiStudioConfig
  | ResolvedGoogleCloudAgentPlatformConfig;

export type ProviderResolutionErrorCode =
  | 'MISSING_CONFIGURATION'
  | 'INVALID_CONFIGURATION'
  | 'SELECTION_UNAVAILABLE';

export interface ProviderResolutionError {
  code: ProviderResolutionErrorCode;
  message: string;
}

export type ProviderResolutionResult =
  | { success: true; config: ResolvedProviderConfig }
  | { success: false; error: ProviderResolutionError };
