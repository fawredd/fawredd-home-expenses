/**
 * In-memory job queue (later replace with pg-boss)
 * This is a simple implementation for local development
 */

export type JobType = "extract" | "categorize" | "reprocess";
export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "retry";

export interface Job {
  id: string;
  documentId?: string;
  movementId?: string;
  jobType: JobType;
  status: JobStatus;
  priority: number;
  retryCount: number;
  maxRetries: number;
  payload: Record<string, unknown>;
  errorDetails?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<JobType, (job: Job) => Promise<void>> = new Map();
  private processing: Set<string> = new Set();

  /**
   * Register a handler for a job type
   */
  registerHandler(
    jobType: JobType,
    handler: (job: Job) => Promise<void>,
  ): void {
    this.handlers.set(jobType, handler);
  }

  /**
   * Enqueue a job
   */
  enqueue(
    jobType: JobType,
    payload: Record<string, unknown>,
    options: {
      documentId?: string;
      movementId?: string;
      priority?: number;
      maxRetries?: number;
    } = {},
  ): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const job: Job = {
      id: jobId,
      jobType,
      status: "pending",
      priority: options.priority || 0,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      payload,
      documentId: options.documentId,
      movementId: options.movementId,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    console.log(`[JobQueue] Enqueued job ${jobId} (${jobType})`);

    // Process asynchronously
    setImmediate(() => this.processNext());

    return jobId;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Process next pending job
   */
  private async processNext(): Promise<void> {
    // Get next pending job (highest priority first)
    const pending = Array.from(this.jobs.values())
      .filter((job) => job.status === "pending")
      .sort((a, b) => b.priority - a.priority)[0];

    if (!pending || this.processing.has(pending.id)) {
      return;
    }

    this.processing.add(pending.id);

    try {
      const handler = this.handlers.get(pending.jobType);
      if (!handler) {
        throw new Error(
          `No handler registered for job type: ${pending.jobType}`,
        );
      }

      pending.status = "processing";
      pending.startedAt = new Date();

      console.log(
        `[JobQueue] Processing job ${pending.id} (${pending.jobType})`,
      );

      await handler(pending);

      pending.status = "completed";
      pending.completedAt = new Date();
      console.log(`[JobQueue] Completed job ${pending.id}`);
    } catch (error) {
      console.error(`[JobQueue] Job ${pending.id} failed:`, error);

      if (pending.retryCount < pending.maxRetries) {
        pending.retryCount++;
        pending.status = "retry";
        console.log(
          `[JobQueue] Retrying job ${pending.id} (attempt ${pending.retryCount}/${pending.maxRetries})`,
        );

        // Retry after delay
        setTimeout(() => {
          pending.status = "pending";
          this.processNext();
        }, 1000 * pending.retryCount);
      } else {
        pending.status = "failed";
        pending.errorDetails =
          error instanceof Error ? error.message : String(error);
        pending.completedAt = new Date();
      }
    } finally {
      this.processing.delete(pending.id);

      // Process next job
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Get job statistics
   */
  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === "pending").length,
      processing: jobs.filter((j) => j.status === "processing").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      retrying: jobs.filter((j) => j.status === "retry").length,
    };
  }

  /**
   * Clear old completed jobs (keep only last 100)
   */
  cleanup(): void {
    const allJobs = Array.from(this.jobs.values());
    const completedJobs = allJobs
      .filter((j) => j.status === "completed" || j.status === "failed")
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0),
      );

    if (completedJobs.length > 100) {
      completedJobs.slice(100).forEach((job) => {
        this.jobs.delete(job.id);
      });
    }
  }
}

// Global singleton instance
export const jobQueue = new JobQueue();

// Cleanup old jobs every 5 minutes
setInterval(
  () => {
    jobQueue.cleanup();
  },
  5 * 60 * 1000,
);
