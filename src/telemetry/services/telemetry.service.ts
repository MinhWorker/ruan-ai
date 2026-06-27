import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  TelemetryRepository,
  TelemetryQuery,
} from '../repositories/telemetry.repository';
import { TelemetryEvent } from '../interfaces/telemetry-event.interface';
import { AuditRecord } from '../interfaces/audit-record.interface';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(private readonly repository: TelemetryRepository) {}

  recordEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): void {
    const redactedMetadata = this.redactSecrets(event.metadata) as Record<
      string,
      any
    >;
    const redactedMessage = this.redactSecretsString(event.message);

    const fullEvent: TelemetryEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date(),
      message: redactedMessage,
      metadata: redactedMetadata,
    };

    this.repository.addEvent(fullEvent);

    const logMsg = `[Telemetry] ${fullEvent.type} - ${fullEvent.message}`;
    if (event.severity === 'error') {
      this.logger.error(logMsg, JSON.stringify(redactedMetadata));
    } else if (event.severity === 'warn') {
      this.logger.warn(logMsg, JSON.stringify(redactedMetadata));
    } else {
      this.logger.log(logMsg, JSON.stringify(redactedMetadata));
    }
  }

  recordAudit(audit: Omit<AuditRecord, 'id' | 'createdAt'>): void {
    const redactedSummary = this.redactSecretsString(
      audit.proposedWriteSummary,
    );
    const redactedMetadata = this.redactSecrets(
      audit.writerResultMetadata,
    ) as Record<string, any>;

    const fullAudit: AuditRecord = {
      ...audit,
      id: randomUUID(),
      createdAt: new Date(),
      proposedWriteSummary: redactedSummary,
      writerResultMetadata: redactedMetadata,
    };

    this.repository.addAudit(fullAudit);
    this.logger.log(
      `[Audit] ${fullAudit.workflow} policy ${fullAudit.policyDecision} for job ${fullAudit.jobId}`,
    );
  }

  queryEvents(q: TelemetryQuery): TelemetryEvent[] {
    return this.repository.queryEvents(q);
  }

  queryAudits(limit: number = 100): AuditRecord[] {
    return this.repository.queryAudits(limit);
  }

  getEventCount(): number {
    return this.repository.countEvents();
  }

  getAuditCount(): number {
    return this.repository.countAudits();
  }

  /**
   * Redacts secret-like strings from an object.
   */

  public redactSecrets(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return this.redactSecretsString(obj);
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactSecrets(item));
    }

    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const lowerK = k.toLowerCase();
      if (
        lowerK.includes('secret') ||
        lowerK.includes('token') ||
        lowerK.includes('key') ||
        lowerK.includes('password')
      ) {
        redacted[k] = '[REDACTED]';
      } else {
        redacted[k] = this.redactSecrets(v);
      }
    }
    return redacted;
  }

  public redactSecretsString(str: string): string {
    let s = str;
    // GitHub tokens and potential secrets
    s = s.replace(
      /(gh[psuoa]_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]+_[a-zA-Z0-9]+)/g,
      '[REDACTED]',
    );
    // Generic authorization bearers
    s = s.replace(/Bearer\s+[A-Za-z0-9-._~+/]+=*/gi, 'Bearer [REDACTED]');
    // Common key/value secrets in logs or error messages.
    s = s.replace(
      /\b([A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*)([^\s,;]+)/gi,
      '$1[REDACTED]',
    );
    return s;
  }
}
