import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { JobRepository } from './job.repository';
import { InMemoryJobRepository } from './in-memory-job.repository';
import { PostgresJobRepository } from './postgres/postgres-job.repository';
import { JobService } from './job.service';
import { FollowUpRecordRepository } from './follow-up-record.repository';
import { InMemoryFollowUpRecordRepository } from './in-memory-follow-up-record.repository';
import { PostgresFollowUpRecordRepository } from './postgres/postgres-follow-up-record.repository';
import { FollowUpService } from './follow-up.service';
import { PG_POOL } from './postgres/pg-pool';
import type { PgPoolLike } from './postgres/pg-pool';

@Module({
  imports: [ConfigModule],
  providers: [
    JobService,
    FollowUpService,
    InMemoryJobRepository,
    InMemoryFollowUpRecordRepository,
    {
      provide: PG_POOL,
      useFactory: (configService: ConfigService): PgPoolLike | undefined => {
        if (configService.jobStorageMode === 'postgres') {
          return new Pool({
            connectionString: configService.databaseUrl,
          });
        }
        return undefined;
      },
      inject: [ConfigService],
    },
    {
      provide: JobRepository,
      useFactory: (
        configService: ConfigService,
        inMemory: InMemoryJobRepository,
        pool?: PgPoolLike,
      ) => {
        if (configService.jobStorageMode === 'postgres') {
          if (!pool) {
            throw new Error('Postgres job storage selected without PG pool.');
          }
          return new PostgresJobRepository(pool);
        }
        return inMemory;
      },
      inject: [ConfigService, InMemoryJobRepository, PG_POOL],
    },
    {
      provide: FollowUpRecordRepository,
      useFactory: (
        configService: ConfigService,
        inMemory: InMemoryFollowUpRecordRepository,
        pool?: PgPoolLike,
      ) => {
        if (configService.jobStorageMode === 'postgres') {
          if (!pool) {
            throw new Error(
              'Postgres follow-up storage selected without PG pool.',
            );
          }
          return new PostgresFollowUpRecordRepository(pool);
        }
        return inMemory;
      },
      inject: [ConfigService, InMemoryFollowUpRecordRepository, PG_POOL],
    },
  ],
  exports: [
    JobService,
    JobRepository,
    FollowUpService,
    FollowUpRecordRepository,
  ],
})
export class JobModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool?: PgPoolLike) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool?.end?.();
  }
}
