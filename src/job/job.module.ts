import { Module } from '@nestjs/common';
import { JobRepository } from './job.repository';
import { InMemoryJobRepository } from './in-memory-job.repository';
import { JobService } from './job.service';

@Module({
  providers: [
    JobService,
    {
      provide: JobRepository,
      useClass: InMemoryJobRepository,
    },
  ],
  exports: [JobService, JobRepository],
})
export class JobModule {}
