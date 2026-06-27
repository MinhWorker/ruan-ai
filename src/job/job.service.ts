import { Injectable, Optional } from '@nestjs/common';
import { Job, JobStatus } from './interfaces/job.interface';
import { JobRepository } from './job.repository';
import * as crypto from 'crypto';
import { TelemetryService } from '../telemetry/services/telemetry.service';

@Injectable()
export class JobService {
  constructor(
    private readonly jobRepository: JobRepository,
    @Optional() private readonly telemetryService?: TelemetryService,
  ) {}

  async createJob(params: {
    deliveryId: string;
    workflowType: string;
    issueNumber?: number;
    repositoryId?: number;
    repositoryOwner?: string;
    repositoryName?: string;
    senderLogin?: string;
    commentId?: number;
    commentBody?: string;
    installationId?: number;
  }): Promise<Job> {
    const existing = await this.jobRepository.findByDeliveryId(
      params.deliveryId,
    );
    if (existing) {
      return existing;
    }

    const job: Job = {
      jobId: crypto.randomUUID(),
      deliveryId: params.deliveryId,
      status: 'queued',
      attempts: 0,
      workflowType: params.workflowType,
      createdAt: new Date(),
      updatedAt: new Date(),
      issueNumber: params.issueNumber,
      repositoryId: params.repositoryId,
      repositoryOwner: params.repositoryOwner,
      repositoryName: params.repositoryName,
      senderLogin: params.senderLogin,
      commentId: params.commentId,
      commentBody: params.commentBody,
      installationId: params.installationId,
    };

    const savedJob = await this.jobRepository.save(job);

    if (this.telemetryService) {
      this.telemetryService.recordEvent({
        type: 'job_lifecycle',
        severity: 'info',
        jobId: savedJob.jobId,
        message: `Job created with status ${savedJob.status}`,
        repositoryOwner: savedJob.repositoryOwner,
        repositoryName: savedJob.repositoryName,
        issueNumber: savedJob.issueNumber,
        metadata: {
          deliveryId: savedJob.deliveryId,
          workflowType: savedJob.workflowType,
        },
      });
    }

    return savedJob;
  }

  async getJobByDeliveryId(deliveryId: string): Promise<Job | null> {
    return this.jobRepository.findByDeliveryId(deliveryId);
  }

  async updateJobStatus(jobId: string, status: JobStatus): Promise<Job> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    job.status = status;
    const savedJob = await this.jobRepository.save(job);

    if (this.telemetryService) {
      this.telemetryService.recordEvent({
        type: 'job_lifecycle',
        severity: status === 'failed' ? 'error' : 'info',
        jobId: savedJob.jobId,
        message: `Job status updated to ${status}`,
        repositoryOwner: savedJob.repositoryOwner,
        repositoryName: savedJob.repositoryName,
        issueNumber: savedJob.issueNumber,
        metadata: { newStatus: status },
      });
    }

    return savedJob;
  }

  async incrementAttempts(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    job.attempts += 1;
    return this.jobRepository.save(job);
  }
}
