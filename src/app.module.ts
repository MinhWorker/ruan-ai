import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { JobModule } from './job/job.module';
import { WebhookModule } from './webhook/webhook.module';
import { PmWorkflowModule } from './pm-workflow/pm-workflow.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { OpsModule } from './ops/ops.module';
import { ProviderConfigModule } from './provider-config/provider-config.module';

@Module({
  imports: [
    ConfigModule,
    HealthModule,
    JobModule,
    WebhookModule,
    PmWorkflowModule,
    TelemetryModule,
    OpsModule,
    ProviderConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
