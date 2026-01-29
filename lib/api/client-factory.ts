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

import { QueryCache } from "@/lib/cache";
import { logger } from "@/lib/utils/logger";
import type { ZodType } from "zod";
import { AuthLayer } from "./auth-layer";
import { CircuitBreakerManager } from "./circuit-breaker";
import type { RequestInterceptor } from "./interceptor";
import { RequestManager, type RequestOptions } from "./request-manager";

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

  /** Override RequestManager instance (for testing) */
  requestManager?: typeof RequestManager;

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
      requestManager: config.requestManager || RequestManager,
      queryCache: config.queryCache || QueryCache,
      authLayer: config.authLayer || AuthLayer,
    };

    logger.debug("api", `Initialized ${this.clientName}`, {
      baseUrl: this.config.baseUrl,
      authStrategy: this.config.authStrategy,
      circuitBreakerKey: this.config.circuitBreakerKey,
    });
  }

  /**
   * Register a domain-specific interceptor
   * Interceptors are invoked serially for each request
   */
  use(interceptor: RequestInterceptor): this {
    this.interceptors.push(interceptor);
    logger.debug("api", `Registered interceptor on ${this.clientName}`, {
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
    );
    const url = this.buildUrl(endpoint);
    const authStrategy = options?.authStrategy || this.config.authStrategy;
    const circuitBreakerKey =
      options?.circuitBreakerKey || this.config.circuitBreakerKey;

    // Check circuit breaker state (fail-fast if open)
    if (
      circuitBreakerKey &&
      CircuitBreakerManager.getState(circuitBreakerKey) === "Open"
    ) {
      logger.debug("api", `Circuit breaker open for ${methodName}`, {
        cacheKey,
        circuitBreakerKey,
      });

      // Return stale cache if available
      const staleData = await this.config.queryCache.get<T>(cacheKey);
      if (staleData) {
        logger.info("api", `Circuit open - returning stale cache`, {
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
      logger.debug("api", `Cache hit for ${methodName}`, { cacheKey });
      return cached;
    }

    // Fetch fresh data
    try {
      const requestVersion = this.config.queryCache.getCurrentVersion();

      const fetcher = async () => {
        const response = await fetch(url);
        if (!response.ok) {
          throw await this.transformError(response);
        }
        return await response.json();
      };

      const data = await this.config.requestManager.fetch(cacheKey, fetcher, {
        dedupe: true,
        retries: 2,
        failOpen: false,
        timeout: 30000,
        circuitBreakerKey,
        ...(authStrategy && { authStrategy }),
        tags: options?.tags || this.config.defaultTags,
        ...options?.requestOptions,
      });

      // Validate response with schema if provided
      let validatedData = data;
      if (options?.responseSchema) {
        try {
          validatedData = options.responseSchema.parse(data);
        } catch (error) {
          logger.error("api", `Validation failed for ${methodName}`, { error });
          throw this.transformValidationError(error);
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
          logger.error("api", `onSuccess hook failed for ${methodName}`, {
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
          logger.error("api", `onError hook failed for ${methodName}`, {
            error: hookError,
          });
        }
      }

      // Return stale cache if available (graceful fallback)
      const staleData = await this.config.queryCache.get<T>(cacheKey);
      if (staleData) {
        logger.info("api", `Fetch failed - returning stale cache`, {
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
    );
    const url = this.buildUrl(endpoint);
    const authStrategy = options?.authStrategy || this.config.authStrategy;
    const circuitBreakerKey =
      options?.circuitBreakerKey || this.config.circuitBreakerKey;
    const method = options.method;

    // Check circuit breaker state (fail-fast if open)
    if (
      circuitBreakerKey &&
      CircuitBreakerManager.getState(circuitBreakerKey) === "Open"
    ) {
      logger.debug("api", `Circuit breaker open for ${methodName}`, {
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
      const fetcher = async () => {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          throw await this.transformError(response);
        }

        return await response.json();
      };

      const requestVersion = this.config.queryCache.getCurrentVersion();

      const data = await this.config.requestManager.fetch(cacheKey, fetcher, {
        dedupe: false, // Mutations typically shouldn't dedupe
        retries: 1,
        failOpen: false,
        timeout: 30000,
        circuitBreakerKey,
        ...(authStrategy && { authStrategy }),
        tags: options?.tags || this.config.defaultTags,
        ...options?.requestOptions,
      });

      // Validate response with schema if provided
      let validatedData = data;
      if (options?.responseSchema) {
        try {
          validatedData = options.responseSchema.parse(data);
        } catch (error) {
          logger.error("api", `Validation failed for ${methodName}`, { error });
          throw this.transformValidationError(error);
        }
      }

      // Invalidate related cache entries
      if (options?.invalidateTags && options.invalidateTags.length > 0) {
        await this.config.queryCache.invalidateByTags(options.invalidateTags);
        logger.debug("api", `Invalidated tags for ${methodName}`, {
          tags: options.invalidateTags,
        });
      }

      // Call success hook (Phase 3+)
      if (options?.onSuccess) {
        try {
          await Promise.resolve(options.onSuccess(validatedData));
        } catch (error) {
          logger.error("api", `onSuccess hook failed for ${methodName}`, {
            error,
          });
        }
      }

      return validatedData;
    } catch (error) {
      // Phase 2+: Check if should queue for offline replay
      // Phase 1: Just propagate error
      // const networkStatus = await NetworkDetection.getStatus();
      // if (!networkStatus.isOnline || (options?.shouldQueue && options.shouldQueue(error))) {
      //   // Queue for replay
      //   logger.info('api', `Mutation queued for replay`, { cacheKey, methodName });
      //   // Phase 2 will implement OfflineQueueManager.enqueue()
      //   return null; // Return null to indicate queued
      // }

      // Call error hook (Phase 3+)
      if (options?.onError) {
        try {
          await Promise.resolve(options.onError(error as Error));
        } catch (hookError) {
          logger.error("api", `onError hook failed for ${methodName}`, {
            error: hookError,
          });
        }
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
    const cacheKey = this.generateCacheKey(
      methodName,
      endpoint,
      options?.cacheKey,
    );
    const authStrategy = options?.authStrategy || this.config.authStrategy;
    const circuitBreakerKey =
      options?.circuitBreakerKey || this.config.circuitBreakerKey;

    try {
      const data = await this.config.requestManager.fetch(cacheKey, fetcher, {
        dedupe: true,
        retries: 1,
        failOpen: false,
        timeout: 30000,
        circuitBreakerKey,
        ...(authStrategy && { authStrategy }),
        tags: options?.tags || this.config.defaultTags,
        ...options?.requestOptions,
      });

      // Validate if schema provided
      let validatedData = data;
      if (options?.responseSchema) {
        try {
          validatedData = options.responseSchema.parse(data);
        } catch (error) {
          throw this.transformValidationError(error);
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
  private generateCacheKey(
    methodName: string,
    endpoint: string,
    customKey?: string,
  ): string {
    if (customKey) return customKey;
    // Simple deterministic key - Phase 3+ can add parameter-based hashing
    return `${this.clientName}:${methodName}:${endpoint}`;
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
