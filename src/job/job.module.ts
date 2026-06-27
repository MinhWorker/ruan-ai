import { Module } from '@nestjs/common';
import { JobRepository } from './job.repository';
import { InMemoryJobRepository } from './in-memory-job.repository';
import { JobService } from './job.service';
import { FollowUpRecordRepository } from './follow-up-record.repository';
import { InMemoryFollowUpRecordRepository } from './in-memory-follow-up-record.repository';
import { FollowUpService } from './follow-up.service';

@Module({
  providers: [
    JobService,
    {
      provide: JobRepository,
      useClass: InMemoryJobRepository,
    },
    {
      provide: FollowUpRecordRepository,
      useClass: InMemoryFollowUpRecordRepository,
    },
    FollowUpService,
  ],
  exports: [
    JobService,
    JobRepository,
    FollowUpService,
    FollowUpRecordRepository,
  ],
})
export class JobModule {}
