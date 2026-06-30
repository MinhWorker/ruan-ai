import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { ProviderConfigRepository } from './repositories/provider-config.repository.interface';
import { InMemoryProviderConfigRepository } from './repositories/in-memory-provider-config.repository';
import { ProviderConfigResolverService } from './services/provider-config-resolver.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ProviderConfigRepository,
      useClass: InMemoryProviderConfigRepository,
    },
    ProviderConfigResolverService,
  ],
  exports: [ProviderConfigRepository, ProviderConfigResolverService],
})
export class ProviderConfigModule {}
