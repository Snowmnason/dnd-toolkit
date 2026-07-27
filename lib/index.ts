/**
 * Lib Module - Central barrel exporter
 *
 * Exports all public utilities from lib/* subdirectories.
 * Each subdirectory has its own barrel export (index.ts).
 *
 * Import patterns:
 *   import { logger, AppKernel } from '@/lib';
 *   import { useAuthGuard, SignUpResult } from '@/lib/auth';
 *   import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
 */

// ===== API =====
export * from "./api";

// ===== Auth (Authentication & Authorization) =====
export * from "./auth";

// ===== Config (App Configuration) =====
export * from "../config";

// ===== Database (Supabase & Queries) =====
export * from "./database";

// ===== Error Handling =====
export * from "./error";

// ===== Feature Flags =====
export * from "./feature-flags";

// ===== Kernel (Bootstrap & App Lifecycle) =====
export * from "./kernel";

// ===== Navigation (Route Configuration & Helpers) =====
export * from "./navigation";

// ===== Network (Detection & Status) =====
export * from "./network";

// ===== Offline Support =====
export * from "./offline";

// ===== Premium Features & Subscriptions =====
export * from "./premium";

// ===== Storage (Secure Storage & Encryption) =====
export * from "./storage";

// ===== Utils (Logging, Versioning, Performance) =====
export * from "./utils";

