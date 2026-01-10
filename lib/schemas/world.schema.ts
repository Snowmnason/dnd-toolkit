import { z } from 'zod';

/**
 * Check for dangerous SQL injection characters (run BEFORE any transforms)
 * Rejects input instead of silently transforming for better security
 */
const hasNoDangerousChars = (val: string) => {
  // Check for SQL injection patterns: quotes, semicolons, comment markers
  return !/['"`;<>]|--|\/\*|\*\//.test(val);
};

/**
 * Check for SQL keywords (case-insensitive, run BEFORE any transforms)
 */
const hasNoSqlKeywords = (val: string) => {
  const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT|JAVASCRIPT|ONERROR|ONLOAD)\b/i;
  return !sqlKeywords.test(val);
};

/**
 * World validation schema
 * Matches the existing validation rules from lib/auth/validation.ts with SQL injection protection
 * Validates BEFORE any transforms to prevent sneaky SQL injection attempts
 */
export const worldSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'World name must be at least 2 characters')
    .max(20, 'World name must be 20 characters or less')
    .refine(hasNoSqlKeywords, 'World name contains reserved words')
    .refine(hasNoDangerousChars, 'World name contains invalid characters')
    .refine(
      val => /^[a-zA-Z0-9\s\-_'.(),!&]*$/.test(val),
      'Only letters, numbers, spaces, and basic punctuation allowed'
    ),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .refine(val => !val || hasNoSqlKeywords(val), 'Description contains reserved words')
    .refine(val => !val || hasNoDangerousChars(val), 'Description contains invalid characters')
    .optional()
    .or(z.literal('')), // Allow empty string
  system: z.enum(['D&D 5e', 'Pathfinder', 'Call of Cthulhu', 'Custom'], {
    message: 'Please select a tabletop system',
  }),
});

/**
 * Schema for editing existing worlds (name must differ from original)
 */
export const editWorldSchema = worldSchema.extend({
  originalName: z.string().optional(),
}).refine(
  (data) => {
    if (data.originalName) {
      return data.name !== data.originalName;
    }
    return true;
  },
  {
    message: 'New world name must be different from the current name',
    path: ['name'],
  }
);

/**
 * Schema for editing just the world name (simplified for edit modal)
 */
export const editWorldNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'World name must be at least 2 characters')
    .max(20, 'World name must be 20 characters or less')
    .refine(hasNoSqlKeywords, 'World name contains reserved words')
    .refine(hasNoDangerousChars, 'World name contains invalid characters')
    .refine(
      val => /^[a-zA-Z0-9\s\-_'.(),!&]*$/.test(val),
      'Only letters, numbers, spaces, and basic punctuation allowed'
    ),
  originalName: z.string().optional(),
}).refine(
  (data) => {
    if (data.originalName) {
      return data.name !== data.originalName;
    }
    return true;
  },
  {
    message: 'New world name must be different from the current name',
    path: ['name'],
  }
);

// Infer TypeScript types from schemas
export type WorldFormData = z.infer<typeof worldSchema>;
export type EditWorldFormData = z.infer<typeof editWorldSchema>;
export type EditWorldNameFormData = z.infer<typeof editWorldNameSchema>;
