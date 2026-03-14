import { z } from "zod";

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
  const sqlKeywords =
    /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT|JAVASCRIPT|ONERROR|ONLOAD)\b/i;
  return !sqlKeywords.test(val);
};

/**
 * Email validation schema with SQL injection protection
 * Validates BEFORE transforms to prevent sneaky SQL injection attempts
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, " ")
  .refine(hasNoSqlKeywords, "Email contains invalid characters")
  .refine(hasNoDangerousChars, "Email contains invalid characters")
  .pipe(z.string().email("Please enter a valid email address"))
  .transform((val) => val.toLowerCase());

/**
 * Password validation schema with SQL injection protection
 * Matches existing validation: min 6 chars, uppercase, lowercase, number, special char
 */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .refine(hasNoSqlKeywords, "Password contains invalid characters")
  .refine(
    (val) => !/[\x00-\x1F\x7F]/.test(val),
    "Password contains invalid characters",
  )
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*(),.?":{}|<>]/,
    "Password must contain at least one special character",
  );

/**
 * Username validation schema with SQL injection protection
 * Matches existing validation: 3-20 chars, starts with letter, alphanumeric + underscores
 * Validates BEFORE any transforms for security
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be 20 characters or less")
  .refine(hasNoSqlKeywords, "Username contains reserved words")
  .refine(hasNoDangerousChars, "Username contains invalid characters")
  .refine((val) => /^[a-zA-Z]/.test(val), "Username must start with a letter")
  .refine(
    (val) => /^[a-zA-Z0-9_]*$/.test(val),
    "Username can only contain letters, numbers, and underscores",
  );

/**
 * Sign-in schema
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"), // Don't validate complexity on sign-in
});

/**
 * Sign-up schema with password confirmation
 */
export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Forgot password schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Reset password schema
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Complete profile schema (username only)
 */
export const completeProfileSchema = z.object({
  username: usernameSchema,
});

/**
 * Update username schema (requires different from original)
 */
export const updateUsernameSchema = z
  .object({
    username: usernameSchema,
    originalUsername: z.string(),
  })
  .refine((data) => data.username !== data.originalUsername, {
    message: "New username must be different",
    path: ["username"],
  });

/**
 * Change password (logged-in settings flow).
 * Requires the current password and a new password with confirmation.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

// Infer TypeScript types from schemas
export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type CompleteProfileFormData = z.infer<typeof completeProfileSchema>;
export type UpdateUsernameFormData = z.infer<typeof updateUsernameSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// ============================================================================
// PASSWORD UI HELPERS (for real-time feedback)
// ============================================================================

/**
 * Validate password and return detailed criteria status
 */
const validatePasswordCriteria = (password: string) => {
  if (typeof password !== "string") {
    return {
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecialChar: false,
      criteriaCount: 0,
      isValid: false,
      strength: "weak" as const,
    };
  }

  const minLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password);

  const criteriaCount = [
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
  ].filter(Boolean).length;

  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    criteriaCount,
    isValid: criteriaCount >= 5,
    strength:
      criteriaCount === 0
        ? ("weak" as const)
        : criteriaCount <= 2
          ? ("weak" as const)
          : criteriaCount <= 3
            ? ("medium" as const)
            : criteriaCount === 4
              ? ("strong" as const)
              : ("very strong" as const),
  };
};

/**
 * Get password requirements text for real-time feedback
 */
export const getPasswordRequirementsForUI = (password: string): string => {
  if (!password) {
    return " ";
  }

  const validation = validatePasswordCriteria(password);
  const missingCriteria = [];

  if (!validation.minLength) missingCriteria.push("6+ characters");
  if (!validation.hasUppercase) missingCriteria.push("uppercase letter");
  if (!validation.hasLowercase) missingCriteria.push("lowercase letter");
  if (!validation.hasNumber) missingCriteria.push("number");
  if (!validation.hasSpecialChar)
    missingCriteria.push("special character (!@#$%^&*...)");

  if (validation.isValid) {
    return `✅ Looks great! All requirements met.`;
  } else {
    return `Need: ${missingCriteria.join(", ")}`;
  }
};
