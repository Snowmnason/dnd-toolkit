/**
 * APIClient Factory - Typed, Domain-Specific API Client Base Class
 *
 * Creates declarative, type-safe API clients with built-in support for:
 * - Automatic cache key generation (deterministic)
 * - QueryCache integration (queries auto-cached)
 * - RequestManager integration (deduplication, retries, circuit breaker)
 * - AuthLayer integration (automatic auth header injection)
 * - Interceptor support (domain-specific hooks)
 * - Error transformation (API errors → typed AppError)
 * - Batch cache invalidation via tags
 * - Network state awareness (queries/mutations aware of offline state)
 * - Privacy redaction (optional, via response schema)
 *
 * Phase 1: Query/mutation execution with caching and validation
 * Phase 2+: Auto-queueing for offline, recovery hooks, batching
 * Phase 4: Auth-on-replay, redaction, scheduled retries
 */

import { AuthLayer } from "@/lib/auth/auth-layer";
import { getCircuitBreakerState } from "@/lib/middleware/api";
import { QueryCache } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import type { ZodType } from "zod";
import { fetchRequest, type RequestInterceptor, type RequestOptions } from "./api-manager";

/**
 * Error transformation result
 * Maps API responses to typed, discriminated union
 */
export type ApiErrorType =
  | { type: "validation"; errors: Record<string, string> }
  | { type: "auth"; code: "unauthorized" | "forbidden" }
  | { type: "not_found" }
  | { type: "network"; message: string }
  | { type: "timeout" }
  | { type: "rate_limited"; retryAfter?: number }
  | { type: "unknown"; message: string };

/**
 * AppError: Error wrapper that includes ApiErrorType metadata
 * Ensures error.message and error.stack are available for downstream consumers
 * (RequestManager analytics, Sentry, interceptor onError handlers)
 */
export class AppError extends Error {
  public apiError: ApiErrorType;

  constructor(apiError: ApiErrorType) {
    const message = AppError.messageFromApiError(apiError);
    super(message);
    this.name = "AppError";
    this.apiError = apiError;
    // Maintain proper stack trace (Node.js/V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Extract a human-readable message from ApiErrorType
   */
  private static messageFromApiError(error: ApiErrorType): string {
    switch (error.type) {
      case "validation":
        return `Validation failed: ${Object.entries(error.errors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join("; ")}`;
      case "auth":
        return `Authentication error: ${error.code}`;
      case "not_found":
        return "Resource not found (404)";
      case "network":
        return error.message || "Network error";
      case "timeout":
        return "Request timeout";
      case "rate_limited":
        return `Rate limited${error.retryAfter ? ` - retry after ${error.retryAfter}s` : ""}`;
      case "unknown":
        return error.message || "Unknown error";
    }
  }
}

/**
 * Query options for read operations (auto-cached, not queued)
 */
export interface QueryOptions<T = any> {
  /** Cache key override (defaults to auto-generated) */
  cacheKey?: string;

  /** Zod schema for response validation and typing */
  responseSchema?: ZodType;

  /** Tags for cache invalidation */
  tags?: string[];

  /** How long before cache is considered stale (ms) */
  staleTime?: number;

  /** How long to keep in cache (ms) */
  cacheTime?: number;

  /** Custom RequestManager options */
  requestOptions?: Partial<RequestOptions>;

  /** Circuit breaker key override */
  circuitBreakerKey?: string;

  /** Auth strategy override */
  authStrategy?: string;

  // Phase 3+ extension point
  onSuccess?: (data: T) => Promise<void> | void;
  onError?: (error: Error) => Promise<void> | void;

  // Phase 3 Improvements
  /** Optional cascade invalidation: invalidate these tags in addition to invalidateTags */
  invalidateOtherTags?: string[];

  // Phase 4 Enhancements
  /** Enable stale-while-revalidate: return stale cache while fetching fresh in background */
  staleWhileRevalidate?: boolean;

  /** Request context for logging, tracing, and interceptor access */
  context?: Record<string, any>;
}

/**
 * Mutation options for write operations (queued when offline)
 */
export interface MutationOptions<T = any> {
  /** HTTP method (POST, PUT, PATCH, DELETE) */
  method: "POST" | "PUT" | "PATCH" | "DELETE";

  /** Cache key override (defaults to auto-generated) */
  cacheKey?: string;

  /** Request body */
  body?: any;

  /** Zod schema for response validation and typing */
  responseSchema?: ZodType;

  /** Tags to invalidate on success */
  invalidateTags?: string[];

  /** Tags to apply to this entry (for future invalidation) */
  tags?: string[];

  /** Custom RequestManager options */
  requestOptions?: Partial<RequestOptions>;

  /** Circuit breaker key override */
  circuitBreakerKey?: string;

  /** Auth strategy override */
  authStrategy?: string;

  // Phase 2+ extension point: mark for offline queueing
  shouldQueue?: (error: unknown) => boolean;

  // Phase 3+ extension point
  onSuccess?: (data: T) => Promise<void> | void;
  onError?: (error: Error) => Promise<void> | void;

  // Phase 3 Improvements
  /** Optional cascade invalidation: invalidate these tags in addition to invalidateTags */
  invalidateOtherTags?: string[];

  /** Validate before write: run checks before mutation (user auth, permissions, etc) */
  validateBeforeWrite?: () => Promise<Record<string, any> | void>;

  /** Retry strategy: which error types should be retried */
  retryOnError?: string[];

  /** No-retry strategy: which error types should NOT be retried */
  noRetryOnError?: string[];

  /** Error handler: map specific errors to custom error types */
  errorHandler?: (error: unknown) => ApiErrorType | null | undefined;

  // Phase 4 Enhancements
  /** Idempotency key: prevents duplicate operations on retry (sent to backend) */
  idempotencyKey?: string;

  /** Request context for logging, tracing, and interceptor access */
  context?: Record<string, any>;
}

/**
 * APIClient configuration
 */
export interface APIClientConfig {
  /** Base URL for all endpoints (e.g., "/api/users") */
  baseUrl: string;

  /** Default auth strategy for all methods (e.g., "user", "service") */
  authStrategy?: string;

  /** Circuit breaker key (defaults to client name, e.g., "users") */
  circuitBreakerKey?: string;

  /** Default cache tags applied to all queries/mutations */
  defaultTags?: string[];

  /** Default stale time for queries (ms) */
  defaultStaleTime?: number;

  /** Default cache time for queries (ms) */
  defaultCacheTime?: number;

  /** Override fetch function (for testing) */
  fetchFn?: typeof fetchRequest;

  /** Override QueryCache instance (for testing) */
  queryCache?: typeof QueryCache;

  /** Override AuthLayer instance (for testing) */
  authLayer?: typeof AuthLayer;
}

/**
 * Base class for domain-specific API clients
 *
 * Usage:
 * ```typescript
 * class UsersAPI extends APIClient {
 *   constructor() {
 *     super({
 *       baseUrl: "/api/users",
 *       authStrategy: "user",
 *       circuitBreakerKey: "users",
 *       defaultTags: ["users"],
 *     });
 *   }
 *
 *   async getUser(userId: string) {
 *     return this.query("getUser", `/users/${userId}`, {
 *       tags: [`user:${userId}`],
 *       responseSchema: UserSchema,
 *     });
 *   }
 *
 *   async updateUser(userId: string, data: UpdateUserRequest) {
 *     return this.mutation("updateUser", `/users/${userId}`, data, {
 *       method: "PATCH",
 *       invalidateTags: [`user:${userId}`, "users"],
 *       responseSchema: UserSchema,
 *     });
 *   }
 * }
 * ```
 */
export abstract class APIClient {
  protected config: Omit<Required<APIClientConfig>, "authStrategy"> & {
    authStrategy?: string;
  };
  protected interceptors: RequestInterceptor[] = [];
  protected clientName: string;

  constructor(config: APIClientConfig) {
    this.clientName = this.constructor.name;
    this.config = {
      baseUrl: config.baseUrl,
      authStrategy: config.authStrategy,
      circuitBreakerKey: config.circuitBreakerKey || this.clientName,
      defaultTags: config.defaultTags || [this.clientName],
      defaultStaleTime: config.defaultStaleTime ?? 2 * 60 * 60 * 1000, // 2 hours
      defaultCacheTime: config.defaultCacheTime ?? 4 * 60 * 60 * 1000, // 4 hours
      fetchFn: config.fetchFn || fetchRequest,
      queryCache: config.queryCache || QueryCache,
      authLayer: config.authLayer || AuthLayer,
    };

    // Phase 5: Validate auth strategy if declared
    if (config.authStrategy) {
      logger.category('auth').debug(`Validating auth strategy for ${this.clientName}`, {
        authStrategy: config.authStrategy,
      });
      // Note: Full validation would require checking AuthLayer registry
      // For now, we log at debug level to help catch misconfiguration
      if (!config.authStrategy.match(/^[a-z-]+$/)) {
        logger.category('auth').warn(`Invalid auth strategy format: ${config.authStrategy}`, {
          clientName: this.clientName,
        });
      }
    }

    logger.category('api').debug(`Initialized ${this.clientName}`, {
      baseUrl: this.config.baseUrl,
      authStrategy: this.config.authStrategy,
      circuitBreakerKey: this.config.circuitBreakerKey,
    });
  }

  /**
   * Register a domain-specific interceptor
   * Interceptors are invoked serially for each request made by this client only
   * (not registered globally; this prevents leaking client-specific behavior into unrelated requests)
   */
  use(interceptor: RequestInterceptor): this {
    this.interceptors.push(interceptor);
    logger.category('api').debug(`Registered interceptor on ${this.clientName}`, {
      interceptorName: interceptor.name || "unnamed",
    });
    return this;
  }

  /**
   * Execute a read-only query
   * Automatically cached via QueryCache; not queued when offline
   *
   * @param methodName - Method name for cache key generation
   * @param endpoint - Endpoint path (appended to baseUrl)
   * @param options - Query options (tags, validation, caching)
   * @returns Promise with response data (typed if schema provided)
   */
  async query<T = any>(
    methodName: string,
    endpoint: string,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    const cacheKey = this.generateCacheKey(
      methodName,
      endpoint,
      options?.cacheKey,
      undefined, // Queries don't have body parameters for hashing
    );
    const url = this.buildUrl(endpoint);
    const authStrategy = options?.authStrategy || this.config.authStrategy;
    const circuitBreakerKey =
      options?.circuitBreakerKey || this.config.circuitBreakerKey;

    // Check circuit breaker state (fail-fast if open)
    if (
      circuitBreakerKey &&
      getCircuitBreakerState(circuitBreakerKey) === "Open"
    ) {
      logger.category('api').debug(`Circuit breaker open for ${methodName}`, {
        cacheKey,
        circuitBreakerKey,
      });

      // Return stale cache if available
      const staleData = await this.config.queryCache.get<T>(cacheKey);
      if (staleData) {
        logger.category('api').info(`Circuit open - returning stale cache`, {
          cacheKey,
        });
        return staleData;
      }

      throw new Error(
        `Circuit breaker open for ${circuitBreakerKey}: ${methodName}`,
      );
    }

    // Check if cache hit (skip fetch if valid)
    const cached = await this.config.queryCache.get<T>(cacheKey);
    const isStale = await this.config.queryCache.isStale(cacheKey);

    if (cached && !isStale) {
      logger.category('api').debug(`Cache hit for ${methodName}`, { cacheKey });
      return cached;
    }

    // Phase 4: Stale-while-revalidate pattern
    // If cache is stale AND staleWhileRevalidate is enabled, return stale immediately
    // and revalidate in background
    if (cached && isStale && options?.staleWhileRevalidate) {
      logger.category('api').debug(`Stale-while-revalidate for ${methodName}`, {
        cacheKey,
      });
      // Return stale data immediately
      // Fire background revalidation without awaiting
      this._revalidateInBackground(methodName, endpoint, options);
      return cached;
    }

    // Fetch fresh data
    try {
      const requestVersion = this.config.queryCache.getCurrentVersion();

      const fetcher = async (injectedHeaders?: Record<string, string>) => {
        const headers: Record<string, string> = {
          // Merge in any injected headers from RequestManager/AuthLayer
          // (includes Authorization, interceptor-modified headers, etc.)
          ...(injectedHeaders || {}),
        };

        const response = await fetch(url, {
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        });
        if (!response.ok) {
          const apiError = await this.transformError(response);
          throw new AppError(apiError);
        }
        return await response.json();
      };

      const data = await this.config.fetchFn(cacheKey, fetcher, {
        dedupe: true,
        retries: 2,
        failOpen: false,
        timeout: 30000,
        circuitBreakerKey,
        ...(authStrategy && { authStrategy }),
        tags: options?.tags || this.config.defaultTags,
        context: options?.context,
        ...(this.interceptors.length > 0 && {
          interceptors: this.interceptors,
        }),
        ...options?.requestOptions,
      });

      // Validate response with schema if provided
      let validatedData = data;
      if (options?.responseSchema) {
        try {
          validatedData = options.responseSchema.parse(data);
        } catch (error) {
          logger.category('api').error(`Validation failed for ${methodName}`, { error });
          const apiError = this.transformValidationError(error);
          throw new AppError(apiError);
        }
      }

      // Cache the validated data
      await this.config.queryCache.set(
        cacheKey,
        validatedData,
        {
          staleTime: options?.staleTime ?? this.config.defaultStaleTime,
          cacheTime: options?.cacheTime ?? this.config.defaultCacheTime,
          tags: options?.tags || this.config.defaultTags,
        },
        requestVersion,
      );

      // Call success hook (Phase 3+)
      if (options?.onSuccess) {
        try {
          await Promise.resolve(options.onSuccess(validatedData));
        } catch (error) {
          logger.category('api').error(`onSuccess hook failed for ${methodName}`, {
            error,
          });
        }
      }

      return validatedData;
    } catch (error) {
      // Call error hook (Phase 3+)
      if (options?.onError) {
        try {
          await Promise.resolve(options.onError(error as Error));
        } catch (hookError) {
          logger.category('api').error(`onError hook failed for ${methodName}`, {
            error: hookError,
          });
        }
      }

      // Return stale cache if available (graceful fallback)
      const staleData = await this.config.queryCache.get<T>(cacheKey);
      if (staleData) {
        logger.category('api').info(`Fetch failed - returning stale cache`, {
          cacheKey,
          error,
        });
        return staleData;
      }

      throw error;
    }
  }

  /**
   * Execute a write operation (mutation)
   * Phase 1: Execute immediately
   * Phase 2+: Auto-queue when offline or circuit open
   * Phase 4+: Apply redaction, auth-on-replay
   *
   * @param methodName - Method name for cache key generation
   * @param endpoint - Endpoint path (appended to baseUrl)
   * @param body - Request body
   * @param options - Mutation options (method, invalidation, validation)
   * @returns Promise with response data (typed if schema provided)
   */
  async mutation<T = any>(
    methodName: string,
    endpoint: string,
    body?: any,
    options?: MutationOptions<T>,
  ): Promise<T | null> {
    if (!options?.method) {
      throw new Error(
        `mutation() requires options.method (POST/PUT/PATCH/DELETE)`,
      );
    }

    const cacheKey = this.generateCacheKey(
      methodName,
      endpoint,
      options?.cacheKey,
      body, // Phase 3: pass body for parameter-based hashing
    );
    const url = this.buildUrl(endpoint);
    const authStrategy = options?.authStrategy || this.config.authStrategy;
    const circuitBreakerKey =
      options?.circuitBreakerKey || this.config.circuitBreakerKey;
    const method = options.method;

    // Phase 3: Run validation before write if provided
    if (options?.validateBeforeWrite) {
      try {
        logger.category('api').debug(`Running validateBeforeWrite for ${methodName}`, {
          cacheKey,
        });
        // Validation runs for side effects (e.g., permission checks)
        // Result is not used in Phase 3 (can be extended in Phase 4 for context passing)
        await options.validateBeforeWrite();
      } catch (error) {
        logger.category('api').error(`validateBeforeWrite failed for ${methodName}`, {
          error,
        });
        throw error;
      }
    }

    // Check circuit breaker state (fail-fast if open)
    if (
      circuitBreakerKey &&
      getCircuitBreakerState(circuitBreakerKey) === "Open"
    ) {
      logger.category('api').debug(`Circuit breaker open for ${methodName}`, {
        cacheKey,
        circuitBreakerKey,
      });

      // Phase 2+: Queue for later replay
      // Phase 1: Just fail
      throw new Error(
        `Circuit breaker open for ${circuitBreakerKey}: ${methodName}`,
      );
    }

    try {
      const fetcher = async (injectedHeaders?: Record<string, string>) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          // Merge in any injected headers from RequestManager/AuthLayer
          // (includes Authorization, interceptor-modified headers, etc.)
          ...(injectedHeaders || {}),
        };

        // Phase 4: Add idempotency key header if provided
        // (explicitly set after injectedHeaders to ensure it's not overridden)
        if (options?.idempotencyKey) {
          headers["Idempotency-Key"] = options.idempotencyKey;
          logger.category('api').debug(`Adding idempotency key for ${methodName}`, {
            idempotencyKey: options.idempotencyKey,
          });
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const apiError = await this.transformError(response);
          throw new AppError(apiError);
        }

        return await response.json();
      };

      const data = await this.config.fetchFn(cacheKey, fetcher, {
        dedupe: false, // Mutations typically shouldn't dedupe
        retries: 1,
        failOpen: false,
        timeout: 30000,
        circuitBreakerKey,
        ...(authStrategy && { authStrategy }),
        tags: options?.tags || this.config.defaultTags,
        context: options?.context,
        idempotencyKey: options?.idempotencyKey,
        ...(this.interceptors.length > 0 && {
          interceptors: this.interceptors,
        }),
        ...options?.requestOptions,
      });

      // Validate response with schema if provided
      let validatedData = data;
      if (options?.responseSchema) {
        try {
          validatedData = options.responseSchema.parse(data);
        } catch (error) {
          logger.category('api').error(`Validation failed for ${methodName}`, { error });
          const apiError = this.transformValidationError(error);
          throw new AppError(apiError);
        }
      }

      // Invalidate related cache entries
      if (options?.invalidateTags && options.invalidateTags.length > 0) {
        await this.config.queryCache.invalidateByTags(options.invalidateTags);
        logger.category('api').debug(`Invalidated tags for ${methodName}`, {
          tags: options.invalidateTags,
        });
      }

      // Phase 3: Cascade invalidation with invalidateOtherTags
      if (
        options?.invalidateOtherTags &&
        options.invalidateOtherTags.length > 0
      ) {
        await this.config.queryCache.invalidateByTags(
          options.invalidateOtherTags,
        );
        logger.category('api').debug(`Cascade invalidated tags for ${methodName}`, {
          tags: options.invalidateOtherTags,
        });
      }

      // Call success hook (Phase 3+)
      if (options?.onSuccess) {
        try {
          await Promise.resolve(options.onSuccess(validatedData));
        } catch (error) {
          logger.category('api').error(`onSuccess hook failed for ${methodName}`, {
            error,
          });
        }
      }

      return validatedData;
    } catch (error) {
      // Phase 3: Apply custom error handler if provided
      if (options?.errorHandler) {
        try {
          const mappedError = options.errorHandler(error);
          if (mappedError) {
              logger.category('api').debug(
                `Custom error handler mapped error for ${methodName}`,
                {
                  from: (error as any)?.type,
                  to: mappedError.type,
                },
              );
            const mappedErr = new Error(
              (error as Error).message || `Error (${mappedError.type})`,
            );
            (mappedErr as any).apiError = mappedError;
            throw mappedErr;
          }
        } catch (handlerError) {
          logger.category('api').error(`Error handler failed for ${methodName}`, {
            error: handlerError,
          });
          // Continue with original error if handler fails
        }
      }

      // Phase 3: Log retry strategy for debugging
      // Note: Actual retry logic is handled by RequestManager
      if (options?.retryOnError || options?.noRetryOnError) {
        const errorType = (error as any)?.type || "unknown";
        logger.category('api').debug(`Error handler evaluated retry strategy`, {
          methodName,
          errorType,
          retryOnError: options?.retryOnError,
          noRetryOnError: options?.noRetryOnError,
        });
      }

      // Phase 2+: Check if should queue for offline replay
      // Phase 1: Just propagate error
      // const networkStatus = await NetworkDetection.getStatus();
      // if (!networkStatus.isOnline || (options?.shouldQueue && options.shouldQueue(error))) {
      //   // Queue for replay
      //   logger.category('api').info(`Mutation queued for replay`, { cacheKey, methodName });
      //   // Phase 2 will implement OfflineQueueManager.enqueue()
      //   return null; // Return null to indicate queued
      // }

      // Call error hook (Phase 3+)
      if (options?.onError) {
        try {
          await Promise.resolve(options.onError(error as Error));
        } catch (hookError) {
          logger.category('api').error(`onError hook failed for ${methodName}`, {
            error: hookError,
          });
        }
      }

      throw error;
    }
  }

  /**
   * Phase 3: Batch query builder for parallel fetches with combiner
   *
   * Useful for fetching multiple related endpoints in parallel:
   * ```typescript
   * const result = await api.batch("getWorldsWithRoles", {
   *   queries: [
   *     { key: "access", url: "/worlds/access/123" },
   *     { key: "owned", url: "/worlds/owned/123" },
   *   ],
   *   combiner: (results) => ({
   *     worldIds: new Set([...results.access, ...results.owned]),
   *   }),
   *   cacheKey: "user:123:worlds-with-roles",
   *   invalidateTags: ["user:123:worlds"],
   * });
   * ```
   */
  async batch<T = any>(
    methodName: string,
    config: {
      queries: { key: string; url: string }[];
      combiner: (results: Record<string, any>) => T;
      cacheKey?: string;
      invalidateTags?: string[];
      tags?: string[];
      staleTime?: number;
      cacheTime?: number;
      onSuccess?: (data: T) => Promise<void> | void;
      onError?: (error: Error) => Promise<void> | void;
    },
  ): Promise<T | null> {
    const cacheKey =
      config.cacheKey ||
      `${this.clientName}:${methodName}:batch:${config.queries.map((q) => q.key).join(",")}`;

    // Check cache first
    const cached = await this.config.queryCache.get<T>(cacheKey);
    const isStale = await this.config.queryCache.isStale(cacheKey);
    if (cached && !isStale) {
      logger.category('api').debug(`Cache hit for batch ${methodName}`, { cacheKey });
      return cached;
    }

    try {
      // Fetch all queries in parallel
      logger.category('api').debug(`Executing batch queries for ${methodName}`, {
        queryCount: config.queries.length,
      });

      // Phase 4: Use allSettled for partial failure handling instead of Promise.all
      const settled = await Promise.allSettled(
        config.queries.map(async (query) => {
          try {
            const response = await fetch(this.buildUrl(query.url));
            if (!response.ok) {
              const apiError = await this.transformError(response);
              throw new AppError(apiError);
            }
            return { [query.key]: await response.json() };
          } catch (error) {
            logger.category('api').error(`Batch query failed for ${query.key}`, {
              error,
            });
            throw error;
          }
        }),
      );

      // Phase 4: Process partial results, don't fail on individual errors
      const combined: Record<string, any> = {};
      const errors: Record<string, Error> = {};
      let successCount = 0;

      settled.forEach((result, index) => {
        // eslint-disable-next-line security/detect-object-injection
        const query = config.queries[index];
        if (result.status === "fulfilled") {
          Object.assign(combined, result.value);
          successCount++;
        } else {
          errors[query.key] = result.reason;
          logger.category('api').warn(`Batch query partial failure for ${query.key}`, {
            error: result.reason,
          });
        }
      });

      // Log partial failure summary
      if (Object.keys(errors).length > 0) {
        logger.category('api').info(
          `Batch completed with partial failures: ${successCount}/${config.queries.length}`,
          {
            failedKeys: Object.keys(errors),
          },
        );
      }

      // Combine results with partial data
      const combinedData = config.combiner({
        ...combined,
        _metadata: {
          successCount,
          failureCount: Object.keys(errors).length,
          failed: errors,
        },
      });

      // Cache the combined result
      const requestVersion = this.config.queryCache.getCurrentVersion();
      await this.config.queryCache.set(
        cacheKey,
        combinedData,
        {
          staleTime: config.staleTime ?? this.config.defaultStaleTime,
          cacheTime: config.cacheTime ?? this.config.defaultCacheTime,
          tags: config.tags || this.config.defaultTags,
        },
        requestVersion,
      );

      // Invalidate related cache entries (Phase 3: added for consistency with mutation)
      if (config.invalidateTags && config.invalidateTags.length > 0) {
        await this.config.queryCache.invalidateByTags(config.invalidateTags);
        logger.category('api').debug(`Invalidated tags for batch ${methodName}`, {
          tags: config.invalidateTags,
        });
      }

      // Call success hook
      if (config.onSuccess) {
        try {
          await Promise.resolve(config.onSuccess(combinedData));
        } catch (error) {
          logger.category('api').error(`onSuccess hook failed for batch ${methodName}`, {
            error,
          });
        }
      }

      return combinedData;
    } catch (error) {
      // Call error hook
      if (config.onError) {
        try {
          await Promise.resolve(config.onError(error as Error));
        } catch (hookError) {
          logger.category('api').error(`onError hook failed for batch ${methodName}`, {
            error: hookError,
          });
        }
      }

      // Return stale cache if available
      const staleData = await this.config.queryCache.get<T>(cacheKey);
      if (staleData) {
        logger.category('api').info(`Batch fetch failed - returning stale cache`, {
          cacheKey,
          error,
        });
        return staleData;
      }

      throw error;
    }
  }

  /**
   * Generic request method for custom scenarios
   * Useful for non-standard endpoints or multi-step operations
   */
  async request<T = any>(
    methodName: string,
    endpoint: string,
    fetcher: () => Promise<any>,
    options?: Partial<QueryOptions<T> & MutationOptions<T>>,
  ): Promise<T | null> {
    // Phase 3: Pass options (potential params) for parameter-based hashing
    const cacheKey = this.generateCacheKey(
      methodName,
      endpoint,
      options?.cacheKey,
      options as any, // Use full options object as params for hashing
    );
    const authStrategy = options?.authStrategy || this.config.authStrategy;
    const circuitBreakerKey =
      options?.circuitBreakerKey || this.config.circuitBreakerKey;

    try {
      const data = await this.config.fetchFn(cacheKey, fetcher, {
        dedupe: true,
        retries: 1,
        failOpen: false,
        timeout: 30000,
        circuitBreakerKey,
        ...(authStrategy && { authStrategy }),
        tags: options?.tags || this.config.defaultTags,
        ...(this.interceptors.length > 0 && {
          interceptors: this.interceptors,
        }),
        ...options?.requestOptions,
      });

      // Validate if schema provided
      let validatedData = data;
      if (options?.responseSchema) {
        try {
          validatedData = options.responseSchema.parse(data);
        } catch (error) {
          const apiError = this.transformValidationError(error);
          throw new AppError(apiError);
        }
      }

      return validatedData;
    } catch (error) {
      throw error;
    }
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Generate deterministic cache key from method name and endpoint
   * Format: `{clientName}:{methodName}:{endpoint}` or custom override
   */
  /**
   * Stable JSON stringify that preserves all nested fields while
   * producing a deterministic key order for objects.
   */
  private stableStringify(value: any): string {
    const seen = new WeakSet<object>();
    const normalize = (val: any): any => {
      if (val === null || typeof val !== "object") {
        return val;
      }
      if (seen.has(val)) {
        // Avoid crashes on circular references; mark cycle location.
        return "[Circular]";
      }
      seen.add(val);
      if (Array.isArray(val)) {
        return val.map((item) => normalize(item));
      }
      const obj: Record<string, any> = {};
      const keys = Object.keys(val).sort();
      for (const key of keys) {
        /* eslint-disable-next-line security/detect-object-injection -- safe: keys are derived from Object.keys(val) */
        obj[key] = normalize((val as any)[key]);
      }
      return obj;
    };
    return JSON.stringify(normalize(value));
  }

  /**
   * Generate deterministic hash for parameters (Phase 3 improvement)
   */
  private hashParameters(params: any): string {
    if (!params) return "";
    try {
      const json = this.stableStringify(params);
      // Simple hash: count characters and XOR bytes for uniqueness
      let hash = 0;
      for (let i = 0; i < json.length; i++) {
        const char = json.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return `_${Math.abs(hash).toString(36)}`;
    } catch {
      // Fallback if stringify fails
      return "";
    }
  }

  /**
   * Phase 4: Revalidate stale cache in background (stale-while-revalidate pattern)
   * Doesn't await; runs in background
   */
  private async _revalidateInBackground<T = any>(
    methodName: string,
    endpoint: string,
    options?: QueryOptions<T>,
  ): Promise<void> {
    try {
      logger.category('api').debug(`Background revalidation started for ${methodName}`);

      const cacheKey = this.generateCacheKey(
        methodName,
        endpoint,
        options?.cacheKey,
      );
      const url = this.buildUrl(endpoint);
      const authStrategy = options?.authStrategy || this.config.authStrategy;

      const fetcher = async (injectedHeaders?: Record<string, string>) => {
        const headers: Record<string, string> = {
          // Merge in any injected headers from RequestManager/AuthLayer
          // (includes Authorization, interceptor-modified headers, etc.)
          ...(injectedHeaders || {}),
        };

        const response = await fetch(url, {
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        });
        if (!response.ok) {
          throw await this.transformError(response);
        }
        return await response.json();
      };

      const data = await this.config.fetchFn(cacheKey, fetcher, {
        dedupe: true,
        retries: 2,
        failOpen: true, // Don't throw on revalidation failure
        timeout: 30000,
        ...(authStrategy && { authStrategy }),
        tags: options?.tags || this.config.defaultTags,
        context: options?.context,
        ...options?.requestOptions,
      });

      if (data) {
        // Validate if schema provided
        let validatedData = data;
        if (options?.responseSchema) {
          try {
            validatedData = options.responseSchema.parse(data);
          } catch (error) {
            logger.category('api').error(`Revalidation validation failed for ${methodName}`, {
              error,
            });
            return; // Don't update cache on validation failure
          }
        }

        // Update cache with fresh data
        const requestVersion = this.config.queryCache.getCurrentVersion();
        await this.config.queryCache.set(
          cacheKey,
          validatedData,
          {
            staleTime: options?.staleTime ?? this.config.defaultStaleTime,
            cacheTime: options?.cacheTime ?? this.config.defaultCacheTime,
            tags: options?.tags || this.config.defaultTags,
          },
          requestVersion,
        );

        logger.category('api').debug(`Background revalidation successful for ${methodName}`);
      }
    } catch (error) {
      logger.category('api').debug(`Background revalidation failed for ${methodName}`, {
        error,
      });
      // Silently fail - don't disrupt user experience
    }
  }

  private generateCacheKey(
    methodName: string,
    endpoint: string,
    customKey?: string,
    params?: any,
  ): string {
    if (customKey) return customKey;
    // Phase 3: Include parameter hash for better deduplication
    const paramHash = this.hashParameters(params);
    return `${this.clientName}:${methodName}:${endpoint}${paramHash}`;
  }

  /**
   * Build full URL from base URL and endpoint
   */
  private buildUrl(endpoint: string): string {
    // Handle already-absolute URLs
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return endpoint;
    }

    // Handle relative endpoints
    const base = this.config.baseUrl.endsWith("/")
      ? this.config.baseUrl
      : `${this.config.baseUrl}/`;

    const path = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
    return `${base}${path}`;
  }

  /**
   * Transform HTTP error response to typed ApiErrorType
   * Handles different error codes and response formats
   */
  private async transformError(response: Response): Promise<ApiErrorType> {
    const status = response.status;

    try {
      const body = await response.json();

      if (status === 401) {
        return { type: "auth", code: "unauthorized" };
      }

      if (status === 403) {
        return { type: "auth", code: "forbidden" };
      }

      if (status === 404) {
        return { type: "not_found" };
      }

      if (status === 408 || status === 504) {
        return { type: "timeout" };
      }

      if (status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        return {
          type: "rate_limited",
          retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
        };
      }

      if (status >= 400 && status < 500) {
        // Validation error
        if (body.errors) {
          return { type: "validation", errors: body.errors };
        }
        return {
          type: "unknown",
          message: body.message || `HTTP ${status}`,
        };
      }

      return {
        type: "unknown",
        message: body.message || `HTTP ${status}`,
      };
    } catch {
      return { type: "network", message: `HTTP ${status}` };
    }
  }

  /**
   * Transform Zod validation error to ApiErrorType
   */
  private transformValidationError(error: unknown): ApiErrorType {
    // If it's a Zod error, extract field errors
    if (error instanceof Error && error.name === "ZodError") {
      const zodError = error as any;
      const errors: Record<string, string> = {};

      if (zodError.errors && Array.isArray(zodError.errors)) {
        for (const err of zodError.errors) {
          const path = err.path.join(".");
          // eslint-disable-next-line security/detect-object-injection
          errors[path] = err.message;
        }
      }

      return { type: "validation", errors };
    }

    return {
      type: "unknown",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export default APIClient;
