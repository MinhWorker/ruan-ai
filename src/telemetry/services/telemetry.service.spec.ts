import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { TelemetryRepository } from '../repositories/telemetry.repository';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let repository: TelemetryRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TelemetryService, TelemetryRepository],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
    repository = module.get<TelemetryRepository>(TelemetryRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordEvent', () => {
    it('should record an event and redact secrets from message and metadata', () => {
      service.recordEvent({
        type: 'job_lifecycle',
        severity: 'info',
        message:
          'Processing github_pat_11ABCD22_59CHARS_59CHARS_59CHARS_59CHARS_59CHARS_59CHARS_59CHARS_59CHARS_59CH',
        metadata: {
          token: 'secret123',
          normalData: 'hello',
          nested: {
            apiKey: 'key456',
          },
        },
      });

      const events = repository.queryEvents();
      expect(events).toHaveLength(1);
      const event = events[0];
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.message).toContain('[REDACTED]');
      expect(event.message).not.toContain('github_pat_');

      const metadata = event.metadata as {
        token?: string;
        normalData?: string;
        nested?: { apiKey?: string };
      };
      expect(metadata?.token).toBe('[REDACTED]');
      expect(metadata?.normalData).toBe('hello');
      expect(metadata?.nested?.apiKey).toBe('[REDACTED]');
    });
  });

  describe('recordAudit', () => {
    it('should record an audit and redact secrets', () => {
      service.recordAudit({
        jobId: 'job-1',
        workflow: 'triage',
        proposedWriteSummary:
          'Added label and token ghp_123456789012345678901234567890123456',
        policyDecision: 'allowed',
        writerResultMetadata: { secretDetails: 'hidden' },
      });

      const audits = repository.queryAudits();
      expect(audits).toHaveLength(1);
      const audit = audits[0];
      expect(audit.id).toBeDefined();
      expect(audit.createdAt).toBeDefined();
      expect(audit.proposedWriteSummary).toContain('[REDACTED]');
      expect(audit.proposedWriteSummary).not.toContain('ghp_');

      const metadata = audit.writerResultMetadata as { secretDetails?: string };
      expect(metadata?.secretDetails).toBe('[REDACTED]');
    });
  });

  describe('redaction behavior', () => {
    it('should redact Bearer tokens', () => {
      const result = service.redactSecretsString(
        'Auth: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz',
      );
      expect(result).toBe('Auth: Bearer [REDACTED]');
    });

    it('should redact ghp_ tokens', () => {
      const result = service.redactSecretsString(
        'ghp_abcdefghijklmnopqrstuvwxyz1234567890',
      );
      expect(result).toBe('[REDACTED]');
    });

    it('should redact key-value secret assignments', () => {
      const result = service.redactSecretsString(
        'GITHUB_WEBHOOK_SECRET=test-secret GOOGLE_API_KEY=abc123 normal=value',
      );

      expect(result).toContain('GITHUB_WEBHOOK_SECRET=[REDACTED]');
      expect(result).toContain('GOOGLE_API_KEY=[REDACTED]');
      expect(result).toContain('normal=value');
      expect(result).not.toContain('test-secret');
      expect(result).not.toContain('abc123');
    });
  });
});
