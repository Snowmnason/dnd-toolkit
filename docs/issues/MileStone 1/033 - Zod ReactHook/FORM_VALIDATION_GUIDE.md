# Form Validation with Zod + React Hook Form

## Overview

All forms in the dnd-toolkit app use **Zod** for schema validation and **React Hook Form (RHF)** for form state management. This provides type-safe, declarative validation with minimal boilerplate.

## Quick Start

### 1. Define Your Schema

Create schemas in `lib/schemas/`:

```typescript
import { z } from 'zod';

// Define the schema
export const myFormSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  email: z.string()
    .email('Invalid email address'),
  description: z.string().optional(),
});

// Export the type
export type MyFormData = z.infer<typeof myFormSchema>;
```

### 2. Use in a Component

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { myFormSchema, type MyFormData } from '@/lib/schemas';

export default function MyFormScreen() {
  const { control, handleSubmit, formState: { isValid } } = useForm<MyFormData>({
    resolver: zodResolver(myFormSchema),
    mode: 'onChange', // Validate on every change
    defaultValues: {
      name: '',
      email: '',
      description: '',
    },
  });

  const onSubmit = async (data: MyFormData) => {
    // data is fully validated and typed!
    console.log(data);
  };

  return (
    <View>
      <FormTextInput
        control={control}
        name="name"
        placeholder="Name"
      />
      
      <Button 
        text="Submit"
        onPress={handleSubmit(onSubmit)}
        disabled={!isValid}
      />
    </View>
  );
}
```

## Form Wrapper Components

We provide pre-built wrappers that integrate RHF with our UI components:

### FormTextInput

Standard text input with validation:

```typescript
<FormTextInput
  control={control}
  name="fieldName"
  placeholder="Enter text"
  // All TextInput props are supported
/>
```

### FormDescInput

Multi-line description input:

```typescript
<FormDescInput
  control={control}
  name="description"
  placeholder="Description"
  multiline
  style={{ height: 200 }}
/>
```

### FormAuthInput

Auth-specific input (sign-in/up screens):

```typescript
<FormAuthInput
  control={control}
  name="email"
  placeholder="Email"
  keyboardType="email-address"
  autoCapitalize="none"
/>
```

### Manual Controller (for custom inputs)

For inputs not covered by wrappers:

```typescript
import { Controller } from 'react-hook-form';

<Controller
  control={control}
  name="system"
  render={({ field, fieldState }) => (
    <>
      <Dropdown
        value={field.value}
        onChange={field.onChange}
        items={items}
      />
      {fieldState.error && (
        <SubTitle color="danger">{fieldState.error.message}</SubTitle>
      )}
    </>
  )}
/>
```

## Built-in SQL Injection Protection

All schemas include protection against SQL injection:

```typescript
// In lib/schemas/index.ts
const dangerousCharsRegex = /['"`;<>]|--|\/\*|\*\//;
const sqlKeywordsRegex = /(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)/i;

// Applied automatically to all string fields
z.string()
  .refine(val => !dangerousCharsRegex.test(val), {
    message: 'Field contains invalid characters'
  })
  .refine(val => !sqlKeywordsRegex.test(val), {
    message: 'Field contains prohibited keywords'
  })
```

## Available Schemas

### Authentication (`lib/schemas/auth.schema.ts`)

- `signInSchema` - Email + password
- `signUpSchema` - Email, username, password, confirmPassword
- `completeProfileSchema` - Username only
- `forgotPasswordSchema` - Email only
- `resetPasswordSchema` - Password + confirmPassword
- `updateUsernameSchema` - Username only

### World Management (`lib/schemas/world.schema.ts`)

- `worldSchema` - Create new world (name, description, system)
- `editWorldSchema` - Edit existing world (relaxed validation)

## Validation Rules

### Email
- Must be valid email format
- Length: 5-320 characters (RFC 5321)
- No SQL keywords or control chars

### Password
- Min 6 characters
- Must include:
  - Uppercase letter
  - Lowercase letter
  - Number
  - Special character (!@#$%^&*...)
- Max 128 characters
- No SQL keywords or control chars

### Username
- Min 3, max 20 characters
- Alphanumeric + underscores/hyphens only
- No spaces
- No SQL injection patterns

### World Name
- Min 2, max 20 characters
- Letters, numbers, spaces, basic punctuation
- No dangerous SQL delimiters

## Password Strength Helpers

For password input UX:

```typescript
import { getPasswordHintColor, getPasswordRequirementsText } from '@/lib/auth/validation';

const password = watch('password'); // from useForm

// Get color based on strength
const hintColor = getPasswordHintColor(password);

// Get requirements text
const requirementsText = getPasswordRequirementsText(password);
// Returns: "✅ Looks great!" or "Need: uppercase letter, number"
```

## Error Display

### Automatic (Form Wrappers)

Form wrappers automatically display validation errors below the input:

```typescript
<FormTextInput control={control} name="email" />
// Error caption appears automatically when invalid
```

### Manual (Custom Inputs)

Access errors via `fieldState`:

```typescript
<Controller
  control={control}
  name="email"
  render={({ field, fieldState }) => (
    <>
      <TextInput {...field} />
      {fieldState.error && (
        <SubTitle color="danger">{fieldState.error.message}</SubTitle>
      )}
    </>
  )}
/>
```

### Form-level Errors

Access all errors via `formState.errors`:

```typescript
const { formState: { errors } } = useForm(...);

{errors.email && <Text>{errors.email.message}</Text>}
```

## Advanced Patterns

### Dependent Fields

Use `watch` for cross-field validation:

```typescript
const password = watch('password');

<FormAuthInput
  control={control}
  name="confirmPassword"
  // Schema validates that passwords match
/>
```

### Dynamic Validation

Trigger validation manually:

```typescript
const { trigger } = useForm(...);

// Validate specific field
await trigger('email');

// Validate all fields
await trigger();
```

### Submit Error Handling

Handle validation failures on submit:

```typescript
const onSubmit = async (data: MyFormData) => {
  // This only runs if validation passes
};

const onError = (errors) => {
  // Handle validation errors
  console.error(errors);
};

<Button onPress={handleSubmit(onSubmit, onError)} />
```

### Reset Form

```typescript
const { reset } = useForm(...);

// Reset to default values
reset();

// Reset with new values
reset({ name: 'New Name' });
```

## TypeScript Integration

All forms are fully typed:

```typescript
// Type is inferred from schema
type MyFormData = z.infer<typeof myFormSchema>;

// RHF knows all field names
const { control } = useForm<MyFormData>(...);

// TypeScript enforces correct field names
<FormTextInput control={control} name="email" /> // ✅
<FormTextInput control={control} name="invalid" /> // ❌ Type error
```

## Performance Tips

1. **Use `mode: 'onChange'`** for real-time validation UX
2. **Use `isValid` from `formState`** to disable submit buttons
3. **Memoize expensive validation** with custom Zod refinements
4. **Avoid unnecessary re-renders** by not watching all fields

## Migration from Legacy Validation

Old pattern (deprecated):
```typescript
const [email, setEmail] = useState('');
const [emailError, setEmailError] = useState('');

const validateAndSetEmail = (value: string) => {
  const result = validateEmail(value);
  if (!result.isValid) {
    setEmailError('Invalid email');
  }
  setEmail(value);
};
```

New pattern (Zod + RHF):
```typescript
const { control } = useForm({
  resolver: zodResolver(signInSchema),
  defaultValues: { email: '' },
});

<FormAuthInput control={control} name="email" />
// Validation is automatic!
```

## Common Issues

### Issue: Form not validating on change
**Solution**: Set `mode: 'onChange'` in useForm config

### Issue: Type errors with `control` prop
**Solution**: Ensure generic type matches: `useForm<MyFormData>`

### Issue: Validation running too often
**Solution**: Use `mode: 'onBlur'` or `mode: 'onSubmit'`

### Issue: Can't access form values
**Solution**: Use `watch()` hook or access via `handleSubmit`

## Related Files

- **Schemas**: `lib/schemas/auth.schema.ts`, `lib/schemas/world.schema.ts`
- **Form Wrappers**: `components/ui/forms/`, `components/auth_components/forms/`
- **Legacy Validators**: `lib/auth/validation.ts` (server-side only)
- **Examples**: `app/login/`, `app/select/create-world.tsx`
