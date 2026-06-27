import { Injectable } from '@nestjs/common';
import { Job, JobStatus } from './interfaces/job.interface';
import { JobRepository } from './job.repository';
import * as crypto from 'crypto';

@Injectable()
export class JobService {
  constructor(private readonly jobRepository: JobRepository) {}

  async createJob(params: {
    deliveryId: string;
    workflowType: string;
    issueNumber?: number;
    repositoryId?: number;
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
      installationId: params.installationId,
    };

    return this.jobRepository.save(job);
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
    return this.jobRepository.save(job);
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
