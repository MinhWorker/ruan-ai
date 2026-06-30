import { Module } from '@nestjs/common';
import { GithubWriter } from './interfaces/github-writer.interface';
import { FakeGithubWriter } from './fake/fake-github-writer';
import { RealGithubWriter } from './real/real-github-writer';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { TelemetryService } from '../telemetry/services/telemetry.service';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [ConfigModule, TelemetryModule],
  providers: [
    {
      provide: GithubWriter,
      inject: [ConfigService, TelemetryService],
      useFactory: (
        config: ConfigService,
        telemetryService: TelemetryService,
      ) => {
        if (config.providerMode === 'real') {
          return new RealGithubWriter(config, telemetryService);
        }
        return new FakeGithubWriter();
      },
    },
  ],
  exports: [GithubWriter],
})
export class GithubWriterModule {}
