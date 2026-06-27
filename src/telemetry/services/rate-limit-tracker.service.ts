import { Injectable } from '@nestjs/common';
import { RateLimitSnapshot } from '../interfaces/rate-limit.interface';

@Injectable()
export class RateLimitTrackerService {
  private aiModelProfile = 'default-model';
  private aiRequestCount = 0;
  private aiEstimatedTokens = 0;
  private aiLastError?: string;
  private aiResetAt?: Date;

  private githubRequestCount = 0;
  private githubLastError?: string;
  private githubResetAt?: Date;

  setConfiguredProfile(profile: string): void {
    this.aiModelProfile = profile;
  }

  recordAiRequest(estimatedTokens: number = 0): void {
    this.aiRequestCount++;
    this.aiEstimatedTokens += estimatedTokens;
  }

  recordAiError(errorMsg: string, resetAt?: Date): void {
    this.aiLastError = errorMsg;
    if (resetAt) {
      this.aiResetAt = resetAt;
    }
  }

  recordGithubRequest(): void {
    this.githubRequestCount++;
  }

  recordGithubError(errorMsg: string, resetAt?: Date): void {
    this.githubLastError = errorMsg;
    if (resetAt) {
      this.githubResetAt = resetAt;
    }
  }

  getSnapshot(): RateLimitSnapshot {
    const now = new Date();

    // Check if we are still in a degraded state based on reset time
    let aiDegraded = false;
    if (this.aiResetAt) {
      if (now < this.aiResetAt) {
        aiDegraded = true;
      } else {
        // Reset period expired
        this.aiResetAt = undefined;
        this.aiLastError = undefined;
      }
    } else if (this.aiLastError) {
      // If we have an error but no reset time, we consider it degraded until next successful request (which isn't fully modeled here, but good enough for fake)
      aiDegraded = true;
    }

    let githubDegraded = false;
    if (this.githubResetAt) {
      if (now < this.githubResetAt) {
        githubDegraded = true;
      } else {
        this.githubResetAt = undefined;
        this.githubLastError = undefined;
      }
    } else if (this.githubLastError) {
      githubDegraded = true;
    }

    return {
      aiModel: {
        configuredProfile: this.aiModelProfile,
        requestCount: this.aiRequestCount,
        estimatedTokens: this.aiEstimatedTokens,
        lastError: this.aiLastError,
        resetAt: this.aiResetAt,
        degradedState: aiDegraded,
      },
      githubApi: {
        requestCount: this.githubRequestCount,
        lastError: this.githubLastError,
        resetAt: this.githubResetAt,
        degradedState: githubDegraded,
      },
    };
  }
}
