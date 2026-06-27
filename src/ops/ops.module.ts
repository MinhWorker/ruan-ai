import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [OpsController],
})
export class OpsModule {}
