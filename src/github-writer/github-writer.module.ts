import { Module } from '@nestjs/common';
import { GithubWriter } from './interfaces/github-writer.interface';
import { FakeGithubWriter } from './fake/fake-github-writer';

@Module({
  providers: [
    {
      provide: GithubWriter,
      useClass: FakeGithubWriter,
    },
  ],
  exports: [GithubWriter],
})
export class GithubWriterModule {}
