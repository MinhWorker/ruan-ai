import { Test, TestingModule } from '@nestjs/testing';
import { StopWorkflowService } from './stop-workflow.service';
import { JobService } from '../../job/job.service';
import { FollowUpService } from '../../job/follow-up.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { Job } from '../../job/interfaces/job.interface';

describe('StopWorkflowService', () => {
  let service: StopWorkflowService;
  let jobService: Partial<JobService>;
  let followUpService: Partial<FollowUpService>;
  let githubWriter: Partial<GithubWriter>;

  beforeEach(async () => {
    jobService = {
      updateJobStatus: jest.fn().mockResolvedValue({}),
      recordFailureEvent: jest.fn(),
    };
    followUpService = {
      cancelPendingForIssue: jest.fn().mockResolvedValue(undefined),
    };
    githubWriter = {
      upsertComment: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StopWorkflowService,
        { provide: JobService, useValue: jobService },
        { provide: FollowUpService, useValue: followUpService },
        { provide: GithubWriter, useValue: githubWriter },
      ],
    }).compile();

    service = module.get<StopWorkflowService>(StopWorkflowService);
  });

  it('should successfully execute stop workflow and cancel follow ups', async () => {
    const job = {
      jobId: '1',
      issueNumber: 1,
      repositoryOwner: 'o',
      repositoryName: 'r',
    } as unknown as Job;
    const result = await service.execute(job);

    expect(result.success).toBe(true);
    expect(followUpService.cancelPendingForIssue).toHaveBeenCalledWith(
      1,
      'o',
      'r',
    );
    expect(githubWriter.upsertComment).toHaveBeenCalled();
    expect(jobService.updateJobStatus).toHaveBeenCalledWith('1', 'paused');
  });
});
