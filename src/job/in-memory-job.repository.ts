import { Injectable } from '@nestjs/common';
import { Job } from './interfaces/job.interface';
import { JobRepository } from './job.repository';

@Injectable()
export class InMemoryJobRepository implements JobRepository {
  private readonly jobs = new Map<string, Job>();

  save(job: Job): Promise<Job> {
    const cloned = { ...job, updatedAt: new Date() };
    this.jobs.set(job.jobId, cloned);
    return Promise.resolve(cloned);
  }

  findById(jobId: string): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    return Promise.resolve(job ? { ...job } : null);
  }

  findByDeliveryId(deliveryId: string): Promise<Job | null> {
    for (const job of this.jobs.values()) {
      if (job.deliveryId === deliveryId) {
        return Promise.resolve({ ...job });
      }
    }
    return Promise.resolve(null);
  }

  findAll(): Promise<Job[]> {
    return Promise.resolve(
      Array.from(this.jobs.values()).map((job) => ({ ...job })),
    );
  }
}
