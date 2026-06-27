import { Controller, Get, Query } from '@nestjs/common';
import { TelemetryService } from '../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../telemetry/services/rate-limit-tracker.service';
import { ModelAvailabilityService } from '../ai/services/model-availability.service';
import { TelemetryQuery } from '../telemetry/repositories/telemetry.repository';

@Controller('ops')
export class OpsController {
  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly rateLimitTracker: RateLimitTrackerService,
    private readonly modelAvailability: ModelAvailabilityService,
  ) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      telemetryEventCount: this.telemetryService.getEventCount(),
      auditRecordCount: this.telemetryService.getAuditCount(),
    };
  }

  @Get('events/job-lifecycle')
  getJobLifecycleEvents(@Query() query: { limit?: string }) {
    const q: TelemetryQuery = {
      limit: query.limit ? parseInt(query.limit, 10) : 100,
      type: 'job_lifecycle',
    };
    return this.telemetryService.queryEvents(q);
  }

  @Get('events/validation-failures')
  getValidationFailures(@Query() query: { limit?: string }) {
    const q: TelemetryQuery = {
      limit: query.limit ? parseInt(query.limit, 10) : 100,
      type: 'validation_failure',
    };
    return this.telemetryService.queryEvents(q);
  }

  @Get('events/policy-rejections')
  getPolicyRejections(@Query() query: { limit?: string }) {
    const q: TelemetryQuery = {
      limit: query.limit ? parseInt(query.limit, 10) : 100,
      type: 'policy_decision',
    };
    // Also include audit records in response for policy rejections if needed, but keeping separate for now
    return this.telemetryService.queryEvents(q);
  }

  @Get('rate-limit')
  getRateLimit() {
    return this.rateLimitTracker.getSnapshot();
  }

  @Get('model-availability')
  getModelAvailability() {
    return this.modelAvailability.validate();
  }

  @Get('audit-records')
  getAuditRecords(@Query('limit') limitStr?: string) {
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    return this.telemetryService.queryAudits(limit);
  }
}
