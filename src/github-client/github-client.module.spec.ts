import { Test, TestingModule } from '@nestjs/testing';
import { GithubClientModule } from './github-client.module';
import { ConfigService } from '../config/config.service';
import { GithubClient } from './interfaces/github-client.interface';
import { RealGithubClient } from './real/real-github-client';
import { FakeGithubClient } from './fake/fake-github-client';

describe('GithubClientModule', () => {
  it('should provide FakeGithubClient when providerMode is fake', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [GithubClientModule],
    })
      .overrideProvider(ConfigService)
      .useValue({ providerMode: 'fake' })
      .compile();

    const client = module.get<GithubClient>(GithubClient);
    expect(client).toBeInstanceOf(FakeGithubClient);
  });

  it('should provide RealGithubClient when providerMode is real', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [GithubClientModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        providerMode: 'real',
        githubAppId: 'app',
        githubAppPrivateKey: 'key',
      })
      .compile();

    const client = module.get<GithubClient>(GithubClient);
    expect(client).toBeInstanceOf(RealGithubClient);
  });
});
