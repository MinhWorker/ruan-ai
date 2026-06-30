import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import {
  ProviderConfigRecord,
  ProviderResolutionResult,
  ProviderFamily,
} from '../interfaces/provider-config.interface';
import { ProviderConfigRepository } from '../repositories/provider-config.repository.interface';

@Injectable()
export class ProviderConfigResolverService {
  constructor(
    private readonly repository: ProviderConfigRepository,
    private readonly configService: ConfigService,
  ) {}

  async resolve(
    installationId: string,
    repositoryId?: string | number,
  ): Promise<ProviderResolutionResult> {
    let activeRecord: ProviderConfigRecord | null = null;

    if (
      repositoryId !== undefined &&
      repositoryId !== null &&
      repositoryId !== ''
    ) {
      const repoIdStr = repositoryId.toString();
      activeRecord = await this.repository.findRepositoryConfig(
        installationId,
        repoIdStr,
      );
    }

    if (!activeRecord) {
      activeRecord =
        await this.repository.findInstallationConfig(installationId);
    }

    if (activeRecord) {
      return this.resolveProviderFromRecord(activeRecord);
    }

    // App-level fallback during migration transition
    const appLevelKey = this.configService.googleAiStudioApiKey;
    if (appLevelKey) {
      return {
        success: true,
        config: {
          providerFamily: 'google-ai-studio',
          rawApiKey: appLevelKey,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'MISSING_CONFIGURATION',
        message: `No provider configuration found for installationId: ${installationId}${
          repositoryId !== undefined &&
          repositoryId !== null &&
          repositoryId !== ''
            ? `, repositoryId: ${repositoryId}`
            : ''
        } and no app-level fallback is configured.`,
      },
    };
  }

  private resolveProviderFromRecord(
    record: ProviderConfigRecord,
  ): ProviderResolutionResult {
    const hasAiStudio = !!record.aiStudioConfig;
    const hasGoogleCloud = !!record.googleCloudAgentPlatformConfig;

    if (!hasAiStudio && !hasGoogleCloud) {
      return {
        success: false,
        error: {
          code: 'INVALID_CONFIGURATION',
          message: `Provider configuration record '${record.id}' has no configured providers.`,
        },
      };
    }

    let selectedFamily: ProviderFamily;

    if (record.preferredProvider) {
      selectedFamily = record.preferredProvider;

      // Fail fast if the explicitly selected provider is not configured
      if (selectedFamily === 'google-cloud-agent-platform' && !hasGoogleCloud) {
        return {
          success: false,
          error: {
            code: 'SELECTION_UNAVAILABLE',
            message: `Preferred provider 'google-cloud-agent-platform' is selected but not configured in record '${record.id}'.`,
          },
        };
      }

      if (selectedFamily === 'google-ai-studio' && !hasAiStudio) {
        return {
          success: false,
          error: {
            code: 'SELECTION_UNAVAILABLE',
            message: `Preferred provider 'google-ai-studio' is selected but not configured in record '${record.id}'.`,
          },
        };
      }
    } else {
      // Precedence default: If both are configured, default to AI Studio. Otherwise, use the one that is configured.
      if (hasAiStudio) {
        selectedFamily = 'google-ai-studio';
      } else {
        selectedFamily = 'google-cloud-agent-platform';
      }
    }

    // Validate the chosen provider family configuration
    if (selectedFamily === 'google-ai-studio') {
      const config = record.aiStudioConfig;
      if (
        !config ||
        !config.apiKeySecretRef ||
        !config.apiKeySecretRef.secretVersionName
      ) {
        return {
          success: false,
          error: {
            code: 'INVALID_CONFIGURATION',
            message: `Google AI Studio configuration is invalid in record '${record.id}': apiKeySecretRef is missing.`,
          },
        };
      }

      return {
        success: true,
        config: {
          providerFamily: 'google-ai-studio',
          apiKeySecretRef: config.apiKeySecretRef,
        },
      };
    } else {
      const config = record.googleCloudAgentPlatformConfig;
      if (!config || !config.projectId || !config.location) {
        return {
          success: false,
          error: {
            code: 'INVALID_CONFIGURATION',
            message: `Google Cloud Agent Platform configuration is invalid in record '${record.id}': projectId or location is missing.`,
          },
        };
      }

      return {
        success: true,
        config: {
          providerFamily: 'google-cloud-agent-platform',
          projectId: config.projectId,
          location: config.location,
          serviceAccountKeySecretRef: config.serviceAccountKeySecretRef,
        },
      };
    }
  }
}
