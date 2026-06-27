import { Job } from './interfaces/job.interface';

export abstract class JobRepository {
  abstract save(job: Job): Promise<Job>;
  abstract findById(jobId: string): Promise<Job | null>;
  abstract findByDeliveryId(deliveryId: string): Promise<Job | null>;
  abstract findAll(): Promise<Job[]>;
}
