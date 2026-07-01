import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { PG_POOL } from '../job/postgres/pg-pool';
import type { PgPoolLike } from '../job/postgres/pg-pool';
import { InMemoryWorkflowStateRepository } from './in-memory-workflow-state.repository';
import { PostgresWorkflowStateRepository } from './postgres/postgres-workflow-state.repository';
import { WorkflowStateRepository } from './workflow-state.repository';

@Module({
  imports: [ConfigModule],
  providers: [
    InMemoryWorkflowStateRepository,
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
      provide: WorkflowStateRepository,
      useFactory: (
        configService: ConfigService,
        inMemory: InMemoryWorkflowStateRepository,
        pool?: PgPoolLike,
      ) => {
        if (configService.jobStorageMode === 'postgres') {
          if (!pool) {
            throw new Error(
              'Postgres workflow-state storage selected without PG pool.',
            );
          }
          return new PostgresWorkflowStateRepository(pool);
        }
        return inMemory;
      },
      inject: [ConfigService, InMemoryWorkflowStateRepository, PG_POOL],
    },
  ],
  exports: [WorkflowStateRepository],
})
export class WorkflowStateModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool?: PgPoolLike) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool?.end?.();
  }
}
