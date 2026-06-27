import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { ConfigModule } from '../config/config.module';
import { JobModule } from '../job/job.module';

@Module({
  imports: [ConfigModule, JobModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
