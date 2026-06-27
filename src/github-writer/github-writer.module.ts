import { Module } from '@nestjs/common';
import { GithubWriter } from './interfaces/github-writer.interface';
import { FakeGithubWriter } from './fake/fake-github-writer';
import { RealGithubWriter } from './real/real-github-writer';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: GithubWriter,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.providerMode === 'real') {
          return new RealGithubWriter(config);
        }
        return new FakeGithubWriter();
      },
    },
  ],
  exports: [GithubWriter],
})
export class GithubWriterModule {}
