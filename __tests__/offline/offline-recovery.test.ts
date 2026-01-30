/**
 * Offline Recovery Module Tests
 *
 * Tests for Phase 4 enhancements:
 * - RedactionManager (PII/token redaction)
 * - NetworkErrorClassifier (error classification)
 * - BackoffScheduler (retry timing with jitter)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BackoffScheduler,
  NetworkErrorClassifier,
  RedactionManager,
  type QueuedMutation,
} from "../../lib/offline/offline-recovery";

// Mock logger to avoid noise in tests
vi.mock("../../lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    category: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe("Offline Recovery Module", () => {
  describe("RedactionManager", () => {
    describe("redactObject", () => {
      it("should redact sensitive fields using default rules", () => {
        const input = {
          user: {
            email: "user@example.com",
            password: "secret123",
            name: "John Doe",
          },
          token: "jwt_token_here",
          apiKey: "key123",
        };

        const result = RedactionManager.redactObject(input);

        expect(result).toEqual({
          user: {
            email: undefined, // Redacted
            password: undefined, // Redacted
            name: "John Doe", // Not redacted
          },
          token: undefined, // Redacted
          apiKey: undefined, // Redacted
        });
      });

      it("should handle nested objects and arrays", () => {
        const input = {
          users: [
            { email: "user1@example.com", name: "User 1" },
            { email: "user2@example.com", password: "pass2" },
          ],
          config: {
            auth: {
              token: "nested_token",
              refreshToken: "refresh_token",
            },
          },
        };

        const result = RedactionManager.redactObject(input);

        expect(result).toEqual({
          users: [
            { email: undefined, name: "User 1" },
            { email: undefined, password: undefined },
          ],
          config: {
            auth: {
              token: undefined,
              refreshToken: undefined,
            },
          },
        });
      });

      it("should redact entire parent object when redactParent is true", () => {
        const customRules = [{ fields: ["sensitive"], redactParent: true }];

        const input = {
          data: {
            sensitive: "secret",
            normal: "ok",
          },
        };

        const result = RedactionManager.redactObject(input, customRules);

        expect(result).toEqual({
          data: undefined, // Entire object redacted
        });
      });

      it("should use custom replacement values", () => {
        const customRules = [{ fields: ["secret"], replacement: "[REDACTED]" }];

        const input = {
          secret: "sensitive_data",
          normal: "ok",
        };

        const result = RedactionManager.redactObject(input, customRules);

        expect(result).toEqual({
          secret: "[REDACTED]", // Custom replacement
          normal: "ok",
        });
      });

      it("should handle circular references safely", () => {
        const input: any = { name: "test" };
        input.self = input; // Circular reference

        const result = RedactionManager.redactObject(input);

        expect(result).toEqual({
          name: "test",
          self: undefined, // Circular reference handled
        });
      });
    });

    describe("validateRedaction", () => {
      it("should detect forbidden fields in objects", () => {
        const input = {
          user: {
            email: "user@example.com",
            password: "secret123",
            name: "John Doe",
          },
          token: "jwt_token",
        };

        const forbiddenFields = ["email", "password", "token"];
        const violations = RedactionManager.validateRedaction(
          input,
          forbiddenFields,
        );

        expect(violations).toEqual(["user.email", "user.password", "token"]);
      });

      it("should detect forbidden fields in nested arrays", () => {
        const input = {
          users: [
            { email: "user1@example.com" },
            { email: "user2@example.com" },
          ],
        };

        const violations = RedactionManager.validateRedaction(input, ["email"]);

        expect(violations).toEqual(["users.0.email", "users.1.email"]);
      });

      it("should return empty array when no violations", () => {
        const input = {
          name: "John Doe",
          age: 30,
        };

        const violations = RedactionManager.validateRedaction(input, [
          "email",
          "password",
        ]);

        expect(violations).toEqual([]);
      });

      it("should handle case-insensitive matching", () => {
        const input = {
          EMAIL: "user@example.com",
          Password: "secret123",
        };

        const violations = RedactionManager.validateRedaction(input, [
          "email",
          "password",
        ]);

        expect(violations).toEqual(["EMAIL", "Password"]);
      });
    });
  });

  describe("NetworkErrorClassifier", () => {
    describe("classify", () => {
      it("should classify network errors", () => {
        const error = new Error("Network request failed");
        const result = NetworkErrorClassifier.classify(error, undefined);

        expect(result).toEqual({
          type: "network",
          retryable: true,
          shouldQueue: true,
          suggestedBackoffMs: 2000,
          message: "Network request failed",
        });
      });

      it("should classify auth errors (401)", () => {
        const error = new Error("Unauthorized");
        const result = NetworkErrorClassifier.classify(error, 401);

        expect(result).toEqual({
          type: "auth",
          statusCode: 401,
          retryable: true,
          shouldQueue: true,
          suggestedBackoffMs: 1000,
          message: "Unauthorized - token may have expired",
        });
      });

      it("should classify auth errors (403)", () => {
        const error = new Error("Forbidden");
        const result = NetworkErrorClassifier.classify(error, 403);

        expect(result).toEqual({
          type: "auth",
          statusCode: 403,
          retryable: false,
          shouldQueue: false,
          message: "Forbidden - insufficient permissions",
        });
      });

      it("should classify not found errors (404)", () => {
        const error = new Error("Not Found");
        const result = NetworkErrorClassifier.classify(error, 404);

        expect(result).toEqual({
          type: "unknown",
          statusCode: 404,
          retryable: false,
          shouldQueue: false,
          message: "Not Found",
        });
      });

      it("should classify validation errors (400)", () => {
        const error = new Error("Bad Request");
        const result = NetworkErrorClassifier.classify(error, 400);

        expect(result).toEqual({
          type: "validation",
          statusCode: 400,
          retryable: false,
          shouldQueue: false,
          message: "Validation failed - payload format invalid",
        });
      });

      it("should classify rate limit errors (429)", () => {
        const error = new Error("Too Many Requests");
        const result = NetworkErrorClassifier.classify(error, 429);

        expect(result).toEqual({
          type: "rate_limit",
          statusCode: 429,
          retryable: true,
          shouldQueue: true,
          suggestedBackoffMs: 30000,
          message: "Rate limited - too many requests",
        });
      });

      it("should classify server errors (5xx)", () => {
        const error = new Error("Internal Server Error");
        const result = NetworkErrorClassifier.classify(error, 500);

        expect(result).toEqual({
          type: "server",
          statusCode: 500,
          retryable: true,
          shouldQueue: true,
          suggestedBackoffMs: 5000,
          message: "Server error - temporary service disruption",
        });
      });

      it("should classify timeout errors", () => {
        const error = new Error("Request timeout");
        const result = NetworkErrorClassifier.classify(error, undefined);

        expect(result).toEqual({
          type: "network",
          retryable: true,
          shouldQueue: true,
          suggestedBackoffMs: 2000,
          message: "Request timeout",
        });
      });

      it("should classify unknown errors", () => {
        const error = new Error("Unknown error");
        const result = NetworkErrorClassifier.classify(error, undefined);

        expect(result).toEqual({
          type: "network",
          retryable: true,
          shouldQueue: true,
          suggestedBackoffMs: 2000,
          message: "Unknown error",
        });
      });

      it("should handle statusCode undefined gracefully", () => {
        const error = new Error("Some error");
        const result = NetworkErrorClassifier.classify(error, undefined);

        expect(result.type).toBe("network");
        expect(result.retryable).toBe(true);
      });

      it("should handle null/undefined error gracefully", () => {
        const result = NetworkErrorClassifier.classify(null as any, undefined);

        expect(result.type).toBe("network");
        expect(result.retryable).toBe(true);
      });
    });
  });

  describe("BackoffScheduler", () => {
    describe("calculateNextAttemptAt", () => {
      it("should calculate exponential backoff with jitter", () => {
        const mutation: QueuedMutation = {
          id: "test-1",
          operation: "create",
          table: "test",
          payload: {},
          ownerId: "user1",
          timestamp: Date.now(),
          retryCount: 0,
        };

        const nextAttempt = BackoffScheduler.calculateNextAttemptAt(mutation);

        expect(nextAttempt).toBeGreaterThan(Date.now());
        expect(nextAttempt).toBeLessThanOrEqual(Date.now() + 4000); // Base 2000ms * 2^0 = 2000ms, with jitter up to ~4000ms
      });

      it("should increase backoff with retry count", () => {
        const mutation1: QueuedMutation = {
          id: "test-1",
          operation: "create",
          table: "test",
          payload: {},
          ownerId: "user1",
          timestamp: Date.now(),
          retryCount: 0,
        };

        const mutation2: QueuedMutation = {
          ...mutation1,
          retryCount: 2,
        };

        const nextAttempt1 = BackoffScheduler.calculateNextAttemptAt(mutation1);
        const nextAttempt2 = BackoffScheduler.calculateNextAttemptAt(mutation2);

        // Higher retry count should result in later attempt time
        expect(nextAttempt2).toBeGreaterThan(nextAttempt1);
      });

      it("should cap backoff at 5 minutes", () => {
        const mutation: QueuedMutation = {
          id: "test-1",
          operation: "create",
          table: "test",
          payload: {},
          ownerId: "user1",
          timestamp: Date.now(),
          retryCount: 10, // High retry count
        };

        const nextAttempt = BackoffScheduler.calculateNextAttemptAt(mutation);

        expect(nextAttempt).toBeLessThanOrEqual(Date.now() + 300000); // 5 minutes max
      });

      it("should apply jitter within expected bounds", () => {
        const mutation: QueuedMutation = {
          id: "test-1",
          operation: "create",
          table: "test",
          payload: {},
          ownerId: "user1",
          timestamp: Date.now(),
          retryCount: 0,
        };

        // Mock Date.now to return a fixed value
        const fixedTime = 1000000000000; // Fixed timestamp
        vi.spyOn(Date, "now").mockReturnValue(fixedTime);

        try {
          // Run multiple times to check jitter distribution
          const delays: number[] = [];
          for (let i = 0; i < 100; i++) {
            const nextAttempt =
              BackoffScheduler.calculateNextAttemptAt(mutation);
            delays.push(nextAttempt - fixedTime);
          }

          const minDelay = Math.min(...delays);
          const maxDelay = Math.max(...delays);

          // Jitter should be between 90% and 110% of base delay (2000ms)
          expect(minDelay).toBeGreaterThanOrEqual(1800); // 2000 * 0.9
          expect(maxDelay).toBeLessThanOrEqual(2200); // 2000 * 1.1
        } finally {
          vi.restoreAllMocks();
        }
      });
    });

    describe("isReadyToRetry", () => {
      it("should return true when no nextAttemptAt is set", () => {
        const mutation: QueuedMutation = {
          id: "test-1",
          operation: "create",
          table: "test",
          payload: {},
          ownerId: "user1",
          timestamp: Date.now(),
          retryCount: 0,
        };

        const ready = BackoffScheduler.isReadyToRetry(mutation);

        expect(ready).toBe(true);
      });

      it("should return true when nextAttemptAt is in the past", () => {
        const mutation: QueuedMutation = {
          id: "test-1",
          operation: "create",
          table: "test",
          payload: {},
          ownerId: "user1",
          timestamp: Date.now(),
          retryCount: 0,
          nextAttemptAt: Date.now() - 1000, // 1 second ago
        };

        const ready = BackoffScheduler.isReadyToRetry(mutation);

        expect(ready).toBe(true);
      });

      it("should return false when nextAttemptAt is in the future", () => {
        const mutation: QueuedMutation = {
          id: "test-1",
          operation: "create",
          table: "test",
          payload: {},
          ownerId: "user1",
          timestamp: Date.now(),
          retryCount: 0,
          nextAttemptAt: Date.now() + 60000, // 1 minute from now
        };

        const ready = BackoffScheduler.isReadyToRetry(mutation);

        expect(ready).toBe(false);
      });

      it("should return true when nextAttemptAt is exactly now", () => {
        const now = Date.now();
        const mutation: QueuedMutation = {
          id: "test-1",
          operation: "create",
          table: "test",
          payload: {},
          ownerId: "user1",
          timestamp: now,
          retryCount: 0,
          nextAttemptAt: now,
        };

        const ready = BackoffScheduler.isReadyToRetry(mutation);

        expect(ready).toBe(true);
      });
    });

    describe("filterReadyMutations", () => {
      it("should filter mutations that are ready to retry", () => {
        const mutations: QueuedMutation[] = [
          {
            id: "ready-1",
            operation: "create",
            table: "test",
            payload: {},
            ownerId: "user1",
            timestamp: Date.now(),
            retryCount: 0,
          },
          {
            id: "not-ready-1",
            operation: "create",
            table: "test",
            payload: {},
            ownerId: "user1",
            timestamp: Date.now(),
            retryCount: 0,
            nextAttemptAt: Date.now() + 60000, // Future
          },
          {
            id: "ready-2",
            operation: "create",
            table: "test",
            payload: {},
            ownerId: "user1",
            timestamp: Date.now(),
            retryCount: 0,
            nextAttemptAt: Date.now() - 1000, // Past
          },
        ];

        const readyMutations = BackoffScheduler.filterReadyMutations(mutations);

        expect(readyMutations).toHaveLength(2);
        expect(readyMutations.map((m) => m.id)).toEqual(["ready-1", "ready-2"]);
      });

      it("should return empty array when no mutations are ready", () => {
        const mutations: QueuedMutation[] = [
          {
            id: "not-ready-1",
            operation: "create",
            table: "test",
            payload: {},
            ownerId: "user1",
            timestamp: Date.now(),
            retryCount: 0,
            nextAttemptAt: Date.now() + 60000,
          },
        ];

        const readyMutations = BackoffScheduler.filterReadyMutations(mutations);

        expect(readyMutations).toEqual([]);
      });
    });
  });
});
