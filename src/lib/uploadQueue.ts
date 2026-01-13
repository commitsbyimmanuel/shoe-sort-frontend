// src/lib/uploadQueue.ts
// FIFO upload queue that processes sequentially and preserves order even during retries.
// A failing job blocks the queue until it succeeds or exhausts retries.

import { apiUrl, MATCH_PATH } from "../config";
import { fetchWithTimeout } from "./http";

export type JobStatus = "pending" | "uploading" | "done" | "error";

export interface QueueJob {
  id: string;
  uri: string;
  locationInfo: string;
  clientId: string;
  status: JobStatus;
  retries: number;
  errorMessage?: string;
}

export interface QueueState {
  jobs: QueueJob[];
  pending: number;
  uploading: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
}

type Listener = (state: QueueState) => void;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class UploadQueue {
  private jobs: QueueJob[] = [];
  private isProcessing = false;
  private listeners = new Set<Listener>();
  private completedCount = 0;

  /**
   * Add a job to the queue. Returns immediately.
   * The job will be processed in FIFO order.
   */
  enqueue(uri: string, locationInfo: string, clientId: string): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job: QueueJob = {
      id,
      uri,
      locationInfo,
      clientId,
      status: "pending",
      retries: 0,
    };
    this.jobs.push(job);
    this.notify();
    this.processNext();
    return id;
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    const pending = this.jobs.filter((j) => j.status === "pending").length;
    const uploading = this.jobs.filter((j) => j.status === "uploading").length;
    const failed = this.jobs.filter((j) => j.status === "error").length;
    return {
      jobs: [...this.jobs],
      pending,
      uploading,
      completed: this.completedCount,
      failed,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear completed jobs from memory (call periodically to prevent memory growth)
   */
  clearCompleted(): void {
    this.jobs = this.jobs.filter((j) => j.status !== "done");
    this.notify();
  }

  /**
   * Check if all jobs are done (no pending, uploading, or error)
   */
  isAllDone(): boolean {
    return this.jobs.every((j) => j.status === "done") && !this.isProcessing;
  }

  /**
   * Retry all failed jobs
   */
  retryFailed(): void {
    for (const job of this.jobs) {
      if (job.status === "error") {
        job.status = "pending";
        job.retries = 0;
        job.errorMessage = undefined;
      }
    }
    this.notify();
    this.processNext();
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;

    // Find first non-done job (this ensures order: we block on current job)
    const job = this.jobs.find(
      (j) => j.status === "pending" || j.status === "uploading"
    );
    if (!job) return;

    this.isProcessing = true;
    job.status = "uploading";
    this.notify();

    try {
      await this.uploadJob(job);
      job.status = "done";
      this.completedCount++;
    } catch (err: any) {
      job.retries++;
      if (job.retries < MAX_RETRIES) {
        // Retry: keep status as pending, will retry on next processNext
        console.log(
          `Upload retry ${job.retries}/${MAX_RETRIES} for ${job.locationInfo}`
        );
        job.status = "pending";
        job.errorMessage = err?.message;
        // Wait before retrying to avoid hammering the server
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        // Exhausted retries: mark as error, but CONTINUE processing next jobs
        // This prevents one bad photo from blocking 999 others
        console.log(`Upload failed permanently for ${job.locationInfo}:`, err);
        job.status = "error";
        job.errorMessage = err?.message || "Upload failed";
      }
    }

    this.isProcessing = false;
    this.notify();

    // Process next job in queue
    this.processNext();
  }

  private async uploadJob(job: QueueJob): Promise<void> {
    // Build filename: "GridA-01-01.jpg" - backend extracts grid from prefix
    // No timestamp = same position overwrites previous photo (allows retakes)
    const filename = `${job.locationInfo}.jpg`;
    
    const fd = new FormData();
    fd.append("file", {
      uri: job.uri,
      name: `capture-${job.clientId}-${Date.now()}.jpg`,
      type: "image/jpeg",
    } as any);
    fd.append("name", filename);

    const url = apiUrl(MATCH_PATH);
    console.log("POST /scan fields:", {
      name: filename,
      file: `capture-${job.clientId}.jpg`,
    });

    const res = await fetchWithTimeout(url, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const result = await res.json();
    console.log("✅ api result", result);
  }
}

// Singleton instance
export const uploadQueue = new UploadQueue();
