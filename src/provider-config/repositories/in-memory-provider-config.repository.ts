import { Injectable } from '@nestjs/common';
import { ProviderConfigRecord } from '../interfaces/provider-config.interface';
import { ProviderConfigRepository } from './provider-config.repository.interface';

@Injectable()
export class InMemoryProviderConfigRepository extends ProviderConfigRepository {
  private readonly records = new Map<string, ProviderConfigRecord>();

  findByInstallationId(
    installationId: string,
  ): Promise<ProviderConfigRecord[]> {
    return Promise.resolve(
      Array.from(this.records.values()).filter(
        (r) => r.installationId === installationId,
      ),
    );
  }

  findRepositoryConfig(
    installationId: string,
    repositoryId: string,
  ): Promise<ProviderConfigRecord | null> {
    const record = Array.from(this.records.values()).find(
      (r) =>
        r.installationId === installationId && r.repositoryId === repositoryId,
    );
    return Promise.resolve(record || null);
  }

  findInstallationConfig(
    installationId: string,
  ): Promise<ProviderConfigRecord | null> {
    const record = Array.from(this.records.values()).find(
      (r) => r.installationId === installationId && !r.repositoryId,
    );
    return Promise.resolve(record || null);
  }

  save(record: ProviderConfigRecord): Promise<ProviderConfigRecord> {
    this.records.set(record.id, record);
    return Promise.resolve(record);
  }

  delete(id: string): Promise<void> {
    this.records.delete(id);
    return Promise.resolve();
  }
}
