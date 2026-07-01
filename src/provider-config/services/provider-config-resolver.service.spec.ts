import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '../../config/config.service';
import { ProviderConfigRepository } from '../repositories/provider-config.repository.interface';
import { InMemoryProviderConfigRepository } from '../repositories/in-memory-provider-config.repository';
import { ProviderConfigResolverService } from './provider-config-resolver.service';
import {
  ProviderConfigRecord,
  ProviderResolutionResult,
  ResolvedAiStudioConfig,
  ResolvedGoogleCloudAgentPlatformConfig,
} from '../interfaces/provider-config.interface';

describe('ProviderConfigResolverService', () => {
  let resolver: ProviderConfigResolverService;
  let repository: ProviderConfigRepository;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      googleAiStudioApiKey: undefined,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderConfigResolverService,
        {
          provide: ProviderConfigRepository,
          useClass: InMemoryProviderConfigRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    resolver = module.get<ProviderConfigResolverService>(
      ProviderConfigResolverService,
    );
    repository = module.get<ProviderConfigRepository>(ProviderConfigRepository);
  });

  function expectAiStudio(
    result: ProviderResolutionResult,
  ): ResolvedAiStudioConfig {
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    expect(result.config.providerFamily).toBe('google-ai-studio');
    return result.config;
  }

  function expectGoogleCloud(
    result: ProviderResolutionResult,
  ): ResolvedGoogleCloudAgentPlatformConfig {
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    expect(result.config.providerFamily).toBe('google-cloud-agent-platform');
    return result.config;
  }

  describe('Precedence & Scope Inheritance', () => {
    it('should fall back to app-level Google AI Studio key when no record exists', async () => {
      mockConfigService.googleAiStudioApiKey = 'app-fallback-api-key';

      const result = await resolver.resolve('inst-123', 'repo-456');

      const config = expectAiStudio(result);
      expect(config.rawApiKey).toBe('app-fallback-api-key');
    });

    it('should return MISSING_CONFIGURATION when no record exists and no app-level key is set', async () => {
      const result = await resolver.resolve('inst-123', 'repo-456');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MISSING_CONFIGURATION');
        expect(result.error.message).toContain(
          'No provider configuration found',
        );
      }
    });

    it('should resolve installation-level config when repository-level is absent', async () => {
      const instRecord: ProviderConfigRecord = {
        id: 'rec-inst',
        installationId: 'inst-123',
        aiStudioConfig: {
          apiKeySecretRef: {
            secretVersionName: 'projects/123/secrets/key-inst/versions/1',
          },
        },
      };
      await repository.save(instRecord);

      const result = await resolver.resolve('inst-123', 'repo-456');

      const config = expectAiStudio(result);
      expect(config.apiKeySecretRef?.secretVersionName).toBe(
        'projects/123/secrets/key-inst/versions/1',
      );
    });

    it('should prioritize repository-level config over installation-level config', async () => {
      const instRecord: ProviderConfigRecord = {
        id: 'rec-inst',
        installationId: 'inst-123',
        aiStudioConfig: {
          apiKeySecretRef: {
            secretVersionName: 'projects/123/secrets/key-inst/versions/1',
          },
        },
      };
      const repoRecord: ProviderConfigRecord = {
        id: 'rec-repo',
        installationId: 'inst-123',
        repositoryId: 'repo-456',
        aiStudioConfig: {
          apiKeySecretRef: {
            secretVersionName: 'projects/123/secrets/key-repo/versions/1',
          },
        },
      };

      await repository.save(instRecord);
      await repository.save(repoRecord);

      const result = await resolver.resolve('inst-123', 'repo-456');

      const config = expectAiStudio(result);
      expect(config.apiKeySecretRef?.secretVersionName).toBe(
        'projects/123/secrets/key-repo/versions/1',
      );
    });

    it('should allow resolving with a numeric repository ID', async () => {
      const repoRecord: ProviderConfigRecord = {
        id: 'rec-repo',
        installationId: 'inst-123',
        repositoryId: '99999',
        aiStudioConfig: {
          apiKeySecretRef: {
            secretVersionName: 'projects/123/secrets/key-repo/versions/1',
          },
        },
      };
      await repository.save(repoRecord);

      const result = await resolver.resolve('inst-123', 99999);

      const config = expectAiStudio(result);
      expect(config.apiKeySecretRef?.secretVersionName).toBe(
        'projects/123/secrets/key-repo/versions/1',
      );
    });
  });

  describe('Provider Selection Defaults', () => {
    it('should default to Google AI Studio if both providers are configured and no preferredProvider is set', async () => {
      const record: ProviderConfigRecord = {
        id: 'rec-both',
        installationId: 'inst-123',
        aiStudioConfig: {
          apiKeySecretRef: {
            secretVersionName: 'projects/123/secrets/ai-key/versions/1',
          },
        },
        googleCloudAgentPlatformConfig: {
          projectId: 'gcp-proj',
          location: 'us-central1',
        },
      };
      await repository.save(record);

      const result = await resolver.resolve('inst-123');

      const config = expectAiStudio(result);
      expect(config.apiKeySecretRef?.secretVersionName).toBe(
        'projects/123/secrets/ai-key/versions/1',
      );
    });

    it('should select Google Cloud Agent Platform if it is the only one configured', async () => {
      const record: ProviderConfigRecord = {
        id: 'rec-only-gcp',
        installationId: 'inst-123',
        googleCloudAgentPlatformConfig: {
          projectId: 'gcp-proj',
          location: 'us-central1',
        },
      };
      await repository.save(record);

      const result = await resolver.resolve('inst-123');

      const config = expectGoogleCloud(result);
      expect(config.projectId).toBe('gcp-proj');
      expect(config.location).toBe('us-central1');
    });
  });

  describe('Preferred Provider Preference', () => {
    it('should respect preferredProvider set to google-cloud-agent-platform', async () => {
      const record: ProviderConfigRecord = {
        id: 'rec-pref-gcp',
        installationId: 'inst-123',
        preferredProvider: 'google-cloud-agent-platform',
        aiStudioConfig: {
          apiKeySecretRef: {
            secretVersionName: 'projects/123/secrets/ai-key/versions/1',
          },
        },
        googleCloudAgentPlatformConfig: {
          projectId: 'gcp-proj-pref',
          location: 'europe-west1',
        },
      };
      await repository.save(record);

      const result = await resolver.resolve('inst-123');

      const config = expectGoogleCloud(result);
      expect(config.projectId).toBe('gcp-proj-pref');
    });

    it('should respect preferredProvider set to google-ai-studio', async () => {
      const record: ProviderConfigRecord = {
        id: 'rec-pref-studio',
        installationId: 'inst-123',
        preferredProvider: 'google-ai-studio',
        aiStudioConfig: {
          apiKeySecretRef: {
            secretVersionName: 'projects/123/secrets/ai-key-pref/versions/1',
          },
        },
        googleCloudAgentPlatformConfig: {
          projectId: 'gcp-proj',
          location: 'us-central1',
        },
      };
      await repository.save(record);

      const result = await resolver.resolve('inst-123');

      const config = expectAiStudio(result);
      expect(config.apiKeySecretRef?.secretVersionName).toBe(
        'projects/123/secrets/ai-key-pref/versions/1',
      );
    });
  });

  describe('Fail Fast & No Silent Fallbacks', () => {
    it('should fail fast if preferred provider google-cloud-agent-platform is selected but not configured', async () => {
      const record: ProviderConfigRecord = {
        id: 'rec-pref-gcp-missing',
        installationId: 'inst-123',
        preferredProvider: 'google-cloud-agent-platform',
        aiStudioConfig: {
          apiKeySecretRef: {
            secretVersionName: 'projects/123/secrets/ai-key/versions/1',
          },
        },
      };
      await repository.save(record);

      // Even if AI Studio config and app-level fallback are configured,
      // we must NOT silently fallback.
      mockConfigService.googleAiStudioApiKey = 'app-fallback-key';

      const result = await resolver.resolve('inst-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SELECTION_UNAVAILABLE');
        expect(result.error.message).toContain(
          "Preferred provider 'google-cloud-agent-platform' is selected but not configured",
        );
      }
    });

    it('should fail fast if preferred provider google-ai-studio is selected but not configured', async () => {
      const record: ProviderConfigRecord = {
        id: 'rec-pref-studio-missing',
        installationId: 'inst-123',
        preferredProvider: 'google-ai-studio',
        googleCloudAgentPlatformConfig: {
          projectId: 'gcp-proj',
          location: 'us-central1',
        },
      };
      await repository.save(record);

      const result = await resolver.resolve('inst-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SELECTION_UNAVAILABLE');
        expect(result.error.message).toContain(
          "Preferred provider 'google-ai-studio' is selected but not configured",
        );
      }
    });

    it('should return INVALID_CONFIGURATION if a record has no providers configured', async () => {
      const record: ProviderConfigRecord = {
        id: 'rec-empty',
        installationId: 'inst-123',
      };
      await repository.save(record);

      const result = await resolver.resolve('inst-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_CONFIGURATION');
        expect(result.error.message).toContain('has no configured providers');
      }
    });

    it('should fail fast with INVALID_CONFIGURATION if chosen AI Studio config is invalid', async () => {
      const record: ProviderConfigRecord = {
        id: 'rec-invalid-studio',
        installationId: 'inst-123',
        aiStudioConfig: {
          apiKeySecretRef: { secretVersionName: '' }, // empty secret name
        },
      };
      await repository.save(record);

      const result = await resolver.resolve('inst-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_CONFIGURATION');
        expect(result.error.message).toContain('apiKeySecretRef is missing');
      }
    });

    it('should fail fast with INVALID_CONFIGURATION if chosen Google Cloud Agent Platform config is invalid', async () => {
      const record: ProviderConfigRecord = {
        id: 'rec-invalid-gcp',
        installationId: 'inst-123',
        googleCloudAgentPlatformConfig: {
          projectId: '', // empty projectId
          location: 'us-central1',
        },
      };
      await repository.save(record);

      const result = await resolver.resolve('inst-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_CONFIGURATION');
        expect(result.error.message).toContain(
          'projectId or location is missing',
        );
      }
    });
  });
});
