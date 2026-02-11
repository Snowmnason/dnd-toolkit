/**
 * Type Inference Guide for APIClient with Zod
 *
 * Phase 4 Enhancement: Better TypeScript DX through Zod type inference
 *
 * This file demonstrates how to use Zod's z.infer<> utility to automatically
 * derive TypeScript types from Zod schemas, reducing boilerplate and keeping
 * types and validation in sync.
 *
 * Usage Patterns:
 */

import { z } from "zod";

// ==========================================
// Pattern 1: Basic Type Inference
// ==========================================

/**
 * Define your Zod schema with comprehensive validation
 * Zod v4: Use standalone validators (z.uuid(), z.datetime(), z.email())
 */
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  createdAt: z.string().datetime(),
  is_admin: z.boolean().default(false),
});

/**
 * Infer the TypeScript type directly from the schema
 * No need to manually define the interface separately!
 */
type User = z.infer<typeof UserSchema>;
// Equivalent to:
// type User = {
//   id: string;
//   email: string;
//   name: string;
//   createdAt: string;
//   is_admin: boolean;
// }

// ==========================================
// Pattern 2: Request/Response Schemas
// ==========================================

const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

const UpdateUserRequestSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
});

type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

// ==========================================
// Pattern 3: Union Types for Discriminated Unions
// ==========================================

const SuccessResponseSchema = z.object({
  status: z.literal("success"),
  data: z.any(),
  timestamp: z.string().datetime(),
});

const ErrorResponseSchema = z.object({
  status: z.literal("error"),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.string()).optional(),
  }),
  timestamp: z.string().datetime(),
});

const ApiResponseSchema = z.union([SuccessResponseSchema, ErrorResponseSchema]);

type ApiResponse = z.infer<typeof ApiResponseSchema>;
// Now type narrowing works perfectly:
// if (response.status === "success") {
//   // response.data is available
// } else {
//   // response.error is available
// }

// ==========================================
// Pattern 4: Array Types
// ==========================================

const WorldSchema = z.object({
  world_id: z.string().uuid(),
  name: z.string(),
  owner_id: z.string().uuid(),
});

type World = z.infer<typeof WorldSchema>;

// Automatically handle arrays
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const WorldListSchema = z.array(WorldSchema);
type WorldList = z.infer<typeof WorldListSchema>;
// Equivalent to: type WorldList = World[]

// ==========================================
// Pattern 5: Nested Schemas
// ==========================================

const UserWithWorldsSchema = UserSchema.extend({
  worlds: z.array(WorldSchema),
  roleInWorlds: z.record(
    z.string(),
    z.enum(["owner", "admin", "editor", "viewer"]),
  ),
});

type UserWithWorlds = z.infer<typeof UserWithWorldsSchema>;

/**
 * Using with APIClient
 *
 * This is a guide showing patterns. For actual implementation, use the APIClient from client-factory.
 */

// Example pattern (documentation only):
// class UsersAPIWithInference extends APIClient {
//   async getUser(userId: string) {
//     return this.query<User>("getUser", `/${userId}`, {
//       responseSchema: UserSchema,
//     });
//   }
// }

// ==========================================
// Pattern 7: Runtime + Compile-Time Safety
// ==========================================

/**
 * Best of both worlds:
 * - Zod validates at runtime (catches API mismatches)
 * - z.infer types check at compile-time (catches code errors)
 */

// Example usage (for documentation):
// const api = new UsersAPIWithInference();
// const user = await api.getUser("123");
// console.log(user?.id); // ✅ OK

// ==========================================
// Pattern 8: Reusable Schema Composition
// ==========================================

/**
 * Compose smaller schemas into larger ones, keeping types in sync
 */

const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const AuditFieldsSchema = z.object({
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid(),
  version: z.number().int().positive(),
});

const AuditedUserSchema = BaseEntitySchema.merge(AuditFieldsSchema).extend({
  email: z.string().email(),
  name: z.string(),
});

type AuditedUser = z.infer<typeof AuditedUserSchema>;
// Automatically includes: id, createdAt, updatedAt, createdBy, updatedBy, version, email, name

// ==========================================
// Pattern 9: Optional & Nullable Handling
// ==========================================

const FlexibleUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  nickname: z.string().optional(), // Optional, omitted from type if not provided
  avatar: z.string().nullable(), // Can be null
  bio: z.string().or(z.null()), // Same as nullable
});

type FlexibleUser = z.infer<typeof FlexibleUserSchema>;
// type FlexibleUser = {
//   id: string;
//   email: string;
//   nickname?: string;
//   avatar: string | null;
//   bio: string | null;
// }

// ==========================================
// Pattern 10: Transformations
// ==========================================

/**
 * Zod can transform data during parsing, and inferred types reflect the output
 * Modern Zod v4 approach: Use z.coerce.date() for Date objects
 */

// Zod v4 best practice for Date objects:
const DateStringSchema = z.coerce.date();

// z.coerce.date() automatically converts strings/numbers to Date objects
// The inferred type is Date, not string
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type TransformedDate = z.infer<typeof DateStringSchema>; // Date

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const UserWithParsedDatesSchema = UserSchema.extend({
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
});

type UserWithParsedDates = z.infer<typeof UserWithParsedDatesSchema>;
// type UserWithParsedDates = {
//   ...other fields...
//   createdAt: Date; // Automatically a Date object after parsing!
// }

// ==========================================
// Summary: Why Use Zod Type Inference
// ==========================================

/**
 * Benefits:
 * 1. ✅ Single source of truth: Schema is the type definition
 * 2. ✅ Runtime + compile-time safety: Zod validates, TypeScript checks
 * 3. ✅ DRY: No manual type duplication
 * 4. ✅ Maintainability: Change schema once, types auto-update
 * 5. ✅ Documentation: Schema is self-documenting (min/max, enum values, etc)
 * 6. ✅ Refactoring: Easy to rename fields, add validation, etc
 *
 * Best Practices:
 * 1. Define Zod schema first, never define interface separately
 * 2. Export both schema and type: `export { UserSchema }; export type { User };`
 * 3. Use composition for complex types (merge, extend, union)
 * 4. Leverage .optional(), .nullable(), .default() for optional fields
 * 5. Use discriminated unions for "tagged" types (success/error responses)
 * 6. Document validation rules in schema (messages, ranges)
 */

export type {
  ApiResponse,
  AuditedUser,
  CreateUserRequest,
  FlexibleUser,
  UpdateUserRequest,
  User,
  UserWithParsedDates,
  UserWithWorlds,
  World,
  WorldList
};

  export {
    ApiResponseSchema,
    AuditedUserSchema,
    CreateUserRequestSchema,
    FlexibleUserSchema,
    UpdateUserRequestSchema,
    UserSchema,
    UserWithWorldsSchema,
    WorldSchema
  };

