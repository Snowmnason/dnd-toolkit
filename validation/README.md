# lib/schemas

Centralized form validation schemas using **Zod**. Provides type-safe runtime validation for auth (sign-up, sign-in, password reset) and world creation/editing. All schemas include SQL injection protection.

## When to Use This Module

**Use this module to:**

- Validate form inputs before submission with runtime type safety
- Get TypeScript types inferred from schemas (single source of truth)
- Ensure consistent validation across app (auth forms, world creation, settings)
- Protect against SQL injection and malicious input
- Validate API responses and [lib/database](../database/README.md) data at runtime
- Coordinate with [lib/auth's auth flows](../auth/README.md) for credential validation

**Do NOT use this for:**

- Server-side validation (implement corresponding checks on backend)
- Business logic rules beyond form validation (use separate domain functions)
- Complex conditional validation requiring context (extend schemas directly)
- Real-time form feedback (use React validation hooks instead)
- API response transformation (use separate data transformation layer)

## Zod Overview

**Zod** is a TypeScript-first schema validation library. Define once, validate everywhere:

```ts
import { z } from "zod";

// Define schema
const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

// Validate data
const result = userSchema.parse({ email: "user@example.com", age: 25 });

// Type inference (automatic)
type User = z.infer<typeof userSchema>;
```

**Key benefits:** Type-safe, chainable, composable, runtime validation, detailed error messages.

## API Reference

### Auth Schemas

#### `emailSchema`

Email format with SQL injection protection.

```ts
import { emailSchema } from "@/lib/schemas";

emailSchema.parse("user@example.com"); // ✅
emailSchema.parse("admin'; DROP TABLE--"); // ❌ Blocked
```

#### `passwordSchema`

Password strength: 6+ chars, uppercase, lowercase, number, special char.

```ts
import { passwordSchema } from "@/lib/schemas";

passwordSchema.parse("MyPassword123!"); // ✅
passwordSchema.parse("weak"); // ❌
```

#### `usernameSchema`

Username: 3-20 chars, starts with letter, alphanumeric + underscores.

```ts
import { usernameSchema } from "@/lib/schemas";

usernameSchema.parse("alice_123"); // ✅
usernameSchema.parse("2invalid"); // ❌
```

#### `signInSchema`

Sign-in form (email + password).

```ts
import { signInSchema, type SignInFormData } from "@/lib/schemas";

type FormData = z.infer<typeof signInSchema>;
```

#### `signUpSchema`

Sign-up form with password confirmation. Throws `ZodError` if passwords don't match.

```ts
import { signUpSchema } from "@/lib/schemas";

const form = {
  email: "user@example.com",
  password: "MyPassword123!",
  confirmPassword: "MyPassword123!",
};
signUpSchema.parse(form); // ✅
```

#### `forgotPasswordSchema`, `resetPasswordSchema`

Forgot password (email only) and reset password (with confirmation).

### World Schemas

#### `worldSchema`

World creation (name, description, system).

```ts
import { worldSchema, type WorldFormData } from "@/lib/schemas";

const world = {
  name: "My Campaign",
  description: "An epic adventure",
  system: "D&D 5e",
};
worldSchema.parse(world); // ✅

type World = z.infer<typeof worldSchema>;
```

**Fields:**
- `name`: 2-20 chars, alphanumeric + basic punctuation, SQL injection protected
- `description`: optional, max 500 chars, SQL injection protected
- `system`: enum of 'D&D 5e' | 'Pathfinder' | 'Call of Cthulhu' | 'Custom'

#### `editWorldSchema`

World edit with name uniqueness check (requires `originalName` for comparison).

#### `editWorldNameSchema`

Simplified schema for name-only edits (in modals).

## Using Zod in Your Code

### Basic Validation

```ts
import { z } from "zod";

const schema = z.string().email();

// With throw
const result = schema.parse("invalid"); // Throws ZodError

// Without throw (safe)
const result = schema.safeParse("invalid");
if (!result.success) {
  console.error(result.error); // ZodError with details
} else {
  console.log(result.data); // Validated data
}
```

### Type Inference

```ts
const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

type User = z.infer<typeof userSchema>;
// = { email: string; age: number; }
```

### Extending Schemas

```ts
const baseSchema = z.object({ email: z.string().email() });

// Extend with new fields
const extended = baseSchema.extend({
  age: z.number().min(18),
});

// Merge two schemas
const merged = baseSchema.merge(addressSchema);
```

### Common Zod Methods

```ts
z.string().min(5).max(20).email().toLowerCase();
z.number().min(0).max(100).int();
z.enum(['red', 'green', 'blue']);
z.array(z.string()).min(1).max(10);
z.string().optional(); // string | undefined
z.object({...}).refine(data => data.password === data.confirm);
```

## Security

All schemas include **SQL injection protection**:

```ts
// ❌ Blocked: SQL keywords
emailSchema.parse("admin'; DROP TABLE users--");
// Error: "Email contains invalid characters"

// ❌ Blocked: Dangerous characters
worldSchema.parse({ name: "World'; DELETE--", ... });
// Error: "World name contains invalid characters"

// ✅ Safe: Normal input
emailSchema.parse("user@example.com");
```

Injection checks run BEFORE transforms to prevent sneaky bypasses.

## React Form Integration

### With React Hook Form

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpFormData } from "@/lib/schemas";

export function SignUpForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = (data: SignUpFormData) => {
    await api.signUp(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}

      <input {...register("password")} type="password" />
      {errors.password && <span>{errors.password.message}</span>}

      <button type="submit">Sign Up</button>
    </form>
  );
}
```

### Manual Validation

```tsx
const form = { email: "user@example.com", password: "MyPassword123!" };
const result = signInSchema.safeParse(form);

if (!result.success) {
  console.error(result.error.flatten()); // Show errors
} else {
  await api.signIn(result.data); // Submit
}
```

## Dependencies

### External Packages

- **`zod`** – Schema validation library
- **`@hookform/resolvers`** – React Hook Form integration (optional, for forms)

### Internal Dependencies

- None (schemas are pure, no app dependencies)

## Error Handling & Edge Cases

### Invalid Input Types

Zod schemas handle type coercion gracefully; unexpected types throw descriptive errors.

### SQL Injection Attempts

All string fields validated against injection patterns; malicious input blocked with clear error messages.

### Schema Version Mismatch

Schemas are versioned with the app; breaking changes require migration planning.

### Large Input Payloads

Schemas don't validate size limits (use API limits instead); focus on format/type validation.

## Performance Notes

- **Validation Speed**: Zod is fast (<1ms for typical forms); no network calls
- **Type Safety**: Compile-time type checking prevents runtime errors
- **Memory Usage**: Minimal; schemas are lightweight and reusable
- **Bundle Size**: Zod adds ~50KB but enables type safety across the app

## Related Modules

- **lib/auth** – Authentication flows, credential handling
- **lib/database** – Data persistence, runtime validation of responses

## File Breakdown

| File              | Purpose                                               | Lines |
| ----------------- | ----------------------------------------------------- | ----- |
| `auth.schema.ts`  | Auth form schemas (sign-up, sign-in, password reset) | ~80   |
| `world.schema.ts` | World creation/editing schemas with system selection | ~60   |
| `index.ts`        | Barrel export for public API                          | 2     |
