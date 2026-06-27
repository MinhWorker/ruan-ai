import { Injectable } from '@nestjs/common';
import {
  TelemetryEvent,
  TelemetrySeverity,
  TelemetryWorkflowType,
} from '../interfaces/telemetry-event.interface';
import { AuditRecord } from '../interfaces/audit-record.interface';

export interface TelemetryQuery {
  startTime?: Date;
  endTime?: Date;
  workflow?: TelemetryWorkflowType;
  repositoryOwner?: string;
  repositoryName?: string;
  issueNumber?: number;
  jobId?: string;
  severity?: TelemetrySeverity;
  type?: string;
  limit?: number;
}

@Injectable()
export class TelemetryRepository {
  private readonly events: TelemetryEvent[] = [];
  private readonly audits: AuditRecord[] = [];
  private readonly maxRecords = 10000;

  addEvent(event: TelemetryEvent): void {
    if (this.events.length >= this.maxRecords) {
      this.events.shift();
    }
    this.events.push(event);
  }

  queryEvents(q: TelemetryQuery = {}): TelemetryEvent[] {
    let result = [...this.events];

    if (q.type) {
      result = result.filter((e) => e.type === q.type);
    }

    if (q.startTime) {
      result = result.filter((e) => e.timestamp >= q.startTime!);
    }
    if (q.endTime) {
      result = result.filter((e) => e.timestamp <= q.endTime!);
    }
    if (q.workflow) {
      result = result.filter((e) => e.workflow === q.workflow);
    }
    if (q.repositoryOwner) {
      result = result.filter((e) => e.repositoryOwner === q.repositoryOwner);
    }
    if (q.repositoryName) {
      result = result.filter((e) => e.repositoryName === q.repositoryName);
    }
    if (q.issueNumber) {
      result = result.filter((e) => e.issueNumber === q.issueNumber);
    }
    if (q.jobId) {
      result = result.filter((e) => e.jobId === q.jobId);
    }
    if (q.severity) {
      result = result.filter((e) => e.severity === q.severity);
    }

    result = result.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    if (q.limit && q.limit > 0) {
      result = result.slice(0, q.limit);
    }

    return result;
  }

  addAudit(audit: AuditRecord): void {
    if (this.audits.length >= this.maxRecords) {
      this.audits.shift();
    }
    this.audits.push(audit);
  }

  queryAudits(limit: number = 100): AuditRecord[] {
    const result = [...this.audits].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return result.slice(0, limit);
  }

  countEvents(): number {
    return this.events.length;
  }

  countAudits(): number {
    return this.audits.length;
  }
}
