import { ProviderConfigRecord } from '../interfaces/provider-config.interface';

export abstract class ProviderConfigRepository {
  abstract findByInstallationId(
    installationId: string,
  ): Promise<ProviderConfigRecord[]>;
  abstract findRepositoryConfig(
    installationId: string,
    repositoryId: string,
  ): Promise<ProviderConfigRecord | null>;
  abstract findInstallationConfig(
    installationId: string,
  ): Promise<ProviderConfigRecord | null>;
  abstract save(record: ProviderConfigRecord): Promise<ProviderConfigRecord>;
  abstract delete(id: string): Promise<void>;
}
