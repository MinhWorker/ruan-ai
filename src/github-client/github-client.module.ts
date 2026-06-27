import { Module } from '@nestjs/common';
import { GithubClient } from './interfaces/github-client.interface';
import { FakeGithubClient } from './fake/fake-github-client';

@Module({
  providers: [
    {
      provide: GithubClient,
      useClass: FakeGithubClient,
    },
  ],
  exports: [GithubClient],
})
export class GithubClientModule {}
