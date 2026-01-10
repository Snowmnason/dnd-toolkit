import { z } from 'zod';

/**
 * World validation schema
 * Matches the existing validation rules from lib/auth/validation.ts
 */
export const worldSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'World name must be at least 2 characters')
    .max(20, 'World name must be 20 characters or less')
    .regex(
      /^[a-zA-Z0-9\s\-_'.(),!&]*$/,
      'Only letters, numbers, spaces, and basic punctuation allowed'
    ),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .or(z.literal('')), // Allow empty string
  system: z.enum(['D&D 5e', 'Pathfinder', 'Call of Cthulhu', 'Custom'], {
    errorMap: () => ({ message: 'Please select a tabletop system' }),
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

// Infer TypeScript types from schemas
export type WorldFormData = z.infer<typeof worldSchema>;
export type EditWorldFormData = z.infer<typeof editWorldSchema>;
