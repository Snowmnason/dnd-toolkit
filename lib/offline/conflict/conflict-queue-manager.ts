/**
 * Conflict Queue Manager (Background API)
 *
 * Singleton manager for the conflict queue. Used by sync-manager to enqueue
 * conflicts for UI display. The useConflictQueue() hook subscribes to updates
 * from this manager.
 *
 * This is NOT a React hook - it's a background singleton that can be imported
 * and called from non-React code (like sync-manager).
 */

import { QueuedMutation, SyncConflict } from "@/type-definitions/mutation-queue-types";
//import { ConflictResolutionResult } from "./conflict-resolution";

export interface ConflictQueueItem {
  id: string; // unique ID for this conflict
  mutation: QueuedMutation;
  conflict: SyncConflict;
  resourceType?: string;
  createdAt: number;
}

type ConflictQueueListener = (queue: ConflictQueueItem[]) => void;

/**
 * Singleton conflict queue manager
 */
class ConflictQueueManager {
  private queue: ConflictQueueItem[] = [];
  private listeners: Set<ConflictQueueListener> = new Set();
  private nextId = 0;

  /**
   * Enqueue a conflict for UI display (called by sync-manager)
   */
  public enqueueConflict(
    mutation: QueuedMutation,
    conflict: SyncConflict,
  ): string {
    const id = `conflict-${this.nextId++}-${Date.now()}`;
    const item: ConflictQueueItem = {
      id,
      mutation,
      conflict,
      createdAt: Date.now(),
    };

    this.queue.push(item);
    this.notifyListeners();

    return id;
  }

  /**
   * Remove a conflict from the queue by ID (called after resolution)
   */
  public removeConflict(id: string): void {
    this.queue = this.queue.filter((item) => item.id !== id);
    this.notifyListeners();
  }

  /**
   * Get current queue (for subscribers)
   */
  public getQueue(): ConflictQueueItem[] {
    return [...this.queue];
  }

  /**
   * Subscribe to queue changes
   * Returns unsubscribe function
   */
  public subscribe(listener: ConflictQueueListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of queue change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.getQueue());
    });
  }

  /**
   * Clear all conflicts (for testing or hard reset)
   */
  public clear(): void {
    this.queue = [];
    this.nextId = 0;
    this.notifyListeners();
  }
}

/**
 * Global singleton instance
 */
let instance: ConflictQueueManager | null = null;

/**
 * Get or create the singleton instance
 */
export function getConflictQueueManager(): ConflictQueueManager {
  if (!instance) {
    instance = new ConflictQueueManager();
  }
  return instance;
}
