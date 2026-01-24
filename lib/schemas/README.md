# lib/schemas

Centralized form validation schemas using **Zod**. Provides type-safe runtime validation for auth (sign-up, sign-in, password reset) and world creation/editing. All schemas include SQL injection protection.

## When to Use This Module

**Use this module to:**

- Validate form inputs before submission with runtime type safety
- Get TypeScript types inferred from schemas (single source of truth)
- Ensure consistent validation across app (auth forms, world creation, settings)
- Protect against SQL injection and malicious input in user input
- Validate API responses and [lib/database](../database/README.md) data at runtime
- Coordinate with [lib/auth's auth flows](../auth/README.md) for credential validation

**Do NOT use this for:**

- Server-side validation (implement corresponding checks on backend)
- Business logic rules beyond form validation (use separate domain functions)
- Complex conditional validation requiring context (extend schemas or use separate validators)
- Real-time form feedback (use React validation hooks instead)
- API response transformation (use separate data transformation layer)

## What is Zod?

**Zod** is a TypeScript-first schema validation library:

```ts
import { z } from "zod";

// Define a schema
const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

// Validate data
const result = userSchema.parse({ email: "user@example.com", age: 25 });

// Get TypeScript type automatically
type User = z.infer<typeof userSchema>;
```

**Benefits:**

- Type-safe: inferred types match validation rules
- Chainable: `.string().email().min(5)` reads naturally
- Composable: extend and combine schemas
- Runtime validation: catches data issues at runtime
- Good errors: detailed error messages

## API Reference

### Auth Schemas

#### `emailSchema`

Validates email format with SQL injection protection.

```ts
import { emailSchema } from "@/lib/schemas";

const result = emailSchema.parse("user@example.com"); // ✅
const result = emailSchema.parse("user'; DROP TABLE--"); // ❌ SQL injection blocked
```

#### `passwordSchema`

Validates password strength: 6+ chars, uppercase, lowercase, number, special char.

```ts
import { passwordSchema } from "@/lib/schemas";

const result = passwordSchema.parse("MyPassword123!"); // ✅
const result = passwordSchema.parse("weak"); // ❌ Too short

type PasswordInput = z.infer<typeof passwordSchema>; // string
```

#### `usernameSchema`

Validates username: 3-20 chars, starts with letter, alphanumeric + underscores.

```ts
import { usernameSchema } from "@/lib/schemas";

const result = usernameSchema.parse("alice_123"); // ✅
const result = usernameSchema.parse("2invalid"); // ❌ Doesn't start with letter
```

#### `signInSchema`

Validates sign-in form (email + password).

```ts
import { signInSchema, type SignInFormData } from "@/lib/schemas";

const form = { email: "user@example.com", password: "pass" };
const result = signInSchema.parse(form); // ✅

// Get type
type FormData = z.infer<typeof signInSchema>;
```

#### `signUpSchema`

Validates sign-up form with password confirmation.

```ts
import { signUpSchema } from "@/lib/schemas";

const form = {
  email: "user@example.com",
  password: "MyPassword123!",
  confirmPassword: "MyPassword123!",
};
const result = signUpSchema.parse(form); // ✅
```

Throws if passwords don't match:

```ts
const form = {
  email: "user@example.com",
  password: "MyPassword123!",
  confirmPassword: "Different123!",
};
signUpSchema.parse(form); // ❌ ZodError: "Passwords do not match"
```

#### `forgotPasswordSchema`

Validates forgot password form (email only).

#### `resetPasswordSchema`

Validates password reset with confirmation.

### World Schemas

#### `worldSchema`

Validates world creation (name, description, system).

```ts
import { worldSchema, type WorldFormData } from "@/lib/schemas";

const world = {
  name: "My Campaign",
  description: "An epic adventure",
  system: "D&D 5e",
};
const result = worldSchema.parse(world); // ✅

type World = z.infer<typeof worldSchema>;
```

**Fields:**

- `name`: 2-20 chars, no SQL injection, alphanumeric + basic punctuation
- `description`: optional, max 500 chars, no SQL injection
- `system`: enum of 'D&D 5e' | 'Pathfinder' | 'Call of Cthulhu' | 'Custom'

#### `editWorldSchema`

Validates world edit with name uniqueness check.

```ts
import { editWorldSchema } from "@/lib/schemas";

const form = {
  name: "New Name",
  description: "Updated description",
  system: "D&D 5e",
  originalName: "Old Name", // For uniqueness check
};
const result = editWorldSchema.parse(form); // ✅ if name changed
```

#### `editWorldNameSchema`

Simplified schema for name-only edits (in modals).

```ts
import { editWorldNameSchema } from "@/lib/schemas";

const form = {
  name: "New Name",
  originalName: "Old Name",
};
const result = editWorldNameSchema.parse(form); // ✅
```

## How to Use Zod

### Basic Validation

```ts
import { z } from "zod";

const schema = z.string().email();

try {
  const result = schema.parse("invalid"); // Throws ZodError
} catch (error) {
  console.error(error.errors); // [ { code: 'invalid_string', ... } ]
}
```

### Safe Parsing (No Throw)

```ts
const result = schema.safeParse("invalid");

if (!result.success) {
  console.error(result.error); // ZodError with details
} else {
  console.log(result.data); // Validated data
}
```

### Inferring Types

```ts
const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

// Automatically gets correct type
type User = z.infer<typeof userSchema>;
// = { email: string; age: number; }
```

### Common Zod Methods

```ts
// Strings
z.string().min(1).max(10).email().transform(val => val.toLowerCase());

// Numbers
z.number().min(0).max(100).int().positive();

// Enums
z.enum(['red', 'green', 'blue']);

// Objects
z.object({ name: z.string(), age: z.number() });

// Arrays
z.array(z.string()).min(1).max(10);

// Optional/Nullable
z.string().optional(); // string | undefined
z.string().nullable(); // string | null
z.string().or(z.literal('')); // string | ''

// Conditionals
z.object({ ... }).refine(data => data.password === data.confirm, { path: ['confirm'] });
```

### Extending Schemas

```ts
const baseSchema = z.object({ email: z.string().email() });

// Extend with new fields
const extendedSchema = baseSchema.extend({
  age: z.number().min(18),
});

// Merge two schemas
const merged = baseSchema.merge(addressSchema);
```

## Security

All schemas include **SQL injection protection**:

```ts
// ❌ Blocked: SQL keywords
emailSchema.parse("admin'; DROP TABLE users--");
// Error: "Email contains invalid characters"

// ❌ Blocked: Dangerous characters
worldSchema.parse({ name: "World'; DELETE FROM worlds--", ... });
// Error: "World name contains invalid characters"

// ✅ Safe: Normal input
emailSchema.parse("user@example.com");
```

**Validation order:** Injection checks run BEFORE transforms to prevent sneaky bypasses.

## Dependencies

### External Packages

- **`zod`** – Schema validation library

### Internal Dependencies

- None (schemas are pure, no app dependencies)

## File Breakdown

| File              | Purpose                                               | Exports                        |
| ----------------- | ----------------------------------------------------- | ------------------------------ |
| `auth.schema.ts`  | Auth form schemas (sign-up, sign-in, password reset). | Auth schemas + inferred types  |
| `world.schema.ts` | World creation/editing schemas with system selection. | World schemas + inferred types |
| `index.ts`        | Barrel export for public API.                         | All public schemas and types   |

## Usage in React Forms

### React Hook Form Integration

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
    // data is type-safe and validated
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
  // Show validation errors
  console.error(result.error.flatten());
} else {
  // Submit form
  await api.signIn(result.data);
}
```

## Testing Schemas

```ts
import { signUpSchema } from "@/lib/schemas";

describe("signUpSchema", () => {
  it("accepts valid input", () => {
    expect(
      signUpSchema.safeParse({
        email: "user@example.com",
        password: "MyPassword123!",
        confirmPassword: "MyPassword123!",
      }).success,
    ).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    expect(
      signUpSchema.safeParse({
        email: "user@example.com",
        password: "MyPassword123!",
        confirmPassword: "Different123!",
      }).success,
    ).toBe(false);
  });

  it("blocks SQL injection", () => {
    expect(
      signUpSchema.safeParse({
        email: "admin'; DROP TABLE--@example.com",
        password: "MyPassword123!",
        confirmPassword: "MyPassword123!",
      }).success,
    ).toBe(false);
  });
});
```

## Notes

- All schemas include SQL injection protection via `refine()` checks
- Error messages are user-friendly and displayed directly in forms
- Types are automatically inferred; no manual type definitions needed
- Schemas are immutable (safe to reuse and extend)
