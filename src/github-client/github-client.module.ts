import { Module } from '@nestjs/common';
import { GithubClient } from './interfaces/github-client.interface';
import { FakeGithubClient } from './fake/fake-github-client';
import { RealGithubClient } from './real/real-github-client';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: GithubClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.providerMode === 'real') {
          return new RealGithubClient(config);
        }
        return new FakeGithubClient();
      },
    },
  ],
  exports: [GithubClient],
})
export class GithubClientModule {}
