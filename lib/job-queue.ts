/**
 * PostgreSQL-backed job queue with an in-memory execution loop.
 * Files remain on the local filesystem; PostgreSQL persists job state.
 */
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

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
  deduplicationKey: string;
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
  async enqueue(
    jobType: JobType,
    payload: Record<string, unknown>,
    options: {
      documentId?: string;
      movementId?: string;
      priority?: number;
      maxRetries?: number;
    } = {},
  ): Promise<string> {
    const deduplicationKey = `${jobType}:${options.documentId ?? ""}:${options.movementId ?? ""}`;
    const inserted = await db
      .insert(processingJobs)
      .values({
        jobType,
        documentId: options.documentId,
        movementId: options.movementId,
        priority: options.priority ?? 0,
        retryCount: 0,
        jobStatus: "pending",
        payload,
        deduplicationKey,
      })
      .onConflictDoNothing({ target: processingJobs.deduplicationKey })
      .returning();

    let persistedJob = inserted[0];
    if (!persistedJob) {
      const existing = await db.query.processingJobs.findFirst({
        where: eq(processingJobs.deduplicationKey, deduplicationKey),
      });

      if (!existing) {
        throw new Error(`Unable to persist job ${deduplicationKey}`);
      }

      if (existing.jobStatus === "failed") {
        const retried = await db
          .update(processingJobs)
          .set({
            jobStatus: "pending",
            retryCount: 0,
            errorDetails: null,
            completedAt: null,
          })
          .where(eq(processingJobs.id, existing.id))
          .returning();
        persistedJob = retried[0] ?? existing;
      } else {
        persistedJob = existing;
      }
    }

    const jobId = persistedJob.id;
    const job: Job = {
      id: jobId,
      jobType,
      status: persistedJob.jobStatus as JobStatus,
      priority: persistedJob.priority ?? options.priority ?? 0,
      retryCount: persistedJob.retryCount ?? 0,
      maxRetries: options.maxRetries ?? 3,
      payload,
      documentId: options.documentId,
      movementId: options.movementId,
      createdAt: persistedJob.createdAt,
      startedAt: persistedJob.startedAt ?? undefined,
      completedAt: persistedJob.completedAt ?? undefined,
      deduplicationKey,
    };

    if (job.status === "pending" || job.status === "retry") {
      this.jobs.set(jobId, job);
      console.log(`[JobQueue] Enqueued job ${jobId} (${jobType})`);

      // Process asynchronously
      setImmediate(() => this.processNext());
    }

    return jobId;
  }

  /** Recover pending jobs after a process restart. */
  async recoverPendingJobs(): Promise<void> {
    const pendingJobs = await db
      .select()
      .from(processingJobs)
      .where(inArray(processingJobs.jobStatus, ["pending", "retry"]));

    for (const persistedJob of pendingJobs) {
      const job: Job = {
        id: persistedJob.id,
        jobType: persistedJob.jobType as JobType,
        status: persistedJob.jobStatus as JobStatus,
        priority: persistedJob.priority ?? 0,
        retryCount: persistedJob.retryCount ?? 0,
        maxRetries: 3,
        payload: (persistedJob.payload as Record<string, unknown>) ?? {},
        documentId: persistedJob.documentId ?? undefined,
        movementId: persistedJob.movementId ?? undefined,
        createdAt: persistedJob.createdAt,
        startedAt: persistedJob.startedAt ?? undefined,
        completedAt: persistedJob.completedAt ?? undefined,
        deduplicationKey: persistedJob.deduplicationKey,
      };
      this.jobs.set(job.id, job);
    }

    if (pendingJobs.length > 0) {
      setImmediate(() => this.processNext());
    }
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
      await db
        .update(processingJobs)
        .set({ jobStatus: "processing", startedAt: pending.startedAt })
        .where(eq(processingJobs.id, pending.id));

      console.log(
        `[JobQueue] Processing job ${pending.id} (${pending.jobType})`,
      );

      await handler(pending);

      pending.status = "completed";
      pending.completedAt = new Date();
      await db
        .update(processingJobs)
        .set({ jobStatus: "completed", completedAt: pending.completedAt })
        .where(eq(processingJobs.id, pending.id));
      console.log(`[JobQueue] Completed job ${pending.id}`);
    } catch (error) {
      console.error(`[JobQueue] Job ${pending.id} failed:`, error);

      if (pending.retryCount < pending.maxRetries) {
        pending.retryCount++;
        pending.status = "retry";
        await db
          .update(processingJobs)
          .set({
            jobStatus: "retry",
            retryCount: pending.retryCount,
            errorDetails: {
              message: error instanceof Error ? error.message : String(error),
            },
          })
          .where(eq(processingJobs.id, pending.id));
        console.log(
          `[JobQueue] Retrying job ${pending.id} (attempt ${pending.retryCount}/${pending.maxRetries})`,
        );

        // Retry after delay
        setTimeout(() => {
          pending.status = "pending";
          void db
            .update(processingJobs)
            .set({ jobStatus: "pending" })
            .where(eq(processingJobs.id, pending.id));
          this.processNext();
        }, 1000 * pending.retryCount);
      } else {
        pending.status = "failed";
        pending.errorDetails =
          error instanceof Error ? error.message : String(error);
        pending.completedAt = new Date();
        await db
          .update(processingJobs)
          .set({
            jobStatus: "failed",
            errorDetails: { message: pending.errorDetails },
            completedAt: pending.completedAt,
          })
          .where(eq(processingJobs.id, pending.id));
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
