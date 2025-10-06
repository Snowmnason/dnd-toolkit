// ============================================================================
// CORE VALIDATION FUNCTIONS
// ============================================================================

// Password validation function with enhanced security
export const validatePassword = (password: string) => {
  // Don't sanitize passwords as they may contain special characters intentionally
  // But check for dangerous patterns
  if (typeof password !== 'string') {
    return {
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecialChar: false,
      criteriaCount: 0,
      isValid: false,
      strength: 'weak',
      hasNoSqlKeywords: false,
      hasNoControlChars: false
    };
  }
  
  const minLength = password.length >= 6;
  const maxLength = password.length <= 128; // Reasonable maximum
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  // Safe special characters that don't interfere with common systems
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password);
  
  // Security checks
  const hasNoSqlKeywords = !/(union|select|insert|update|delete|drop|create|alter|exec|script)/i.test(password);
  const hasNoControlChars = !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(password);
  
  const criteriaCount = [minLength, hasUppercase, hasLowercase, hasNumber, hasSpecialChar].filter(Boolean).length;
  
  return {
    minLength,
    maxLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    criteriaCount,
    hasNoSqlKeywords,
    hasNoControlChars,
    isValid: criteriaCount >= 5 && maxLength && hasNoSqlKeywords && hasNoControlChars,
    strength: criteriaCount === 0 ? 'weak' : criteriaCount <= 2 ? 'weak' : criteriaCount <= 3 ? 'medium' : criteriaCount === 4 ? 'strong' : 'very strong'
  };
};

// Input sanitization helper
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters except newline and tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Limit length to prevent DoS
    .slice(0, 1000);
};

// Email validation function with enhanced security
export const validateEmail = (email: string) => {
  // Sanitize input first
  const sanitizedEmail = sanitizeInput(email);
  
  // Enhanced email regex that prevents common injection patterns
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  const isValidFormat = emailRegex.test(sanitizedEmail);
  const hasAtSymbol = sanitizedEmail.includes('@');
  const hasDomain = sanitizedEmail.split('@')[1]?.includes('.') ?? false;
  const hasValidLength = sanitizedEmail.length >= 5 && sanitizedEmail.length <= 320; // RFC 5321 limit
  
  // Additional security checks
  const hasNoSqlKeywords = !/(union|select|insert|update|delete|drop|create|alter|exec|script)/i.test(sanitizedEmail);
  const hasNoControlChars = !/[\x00-\x1F\x7F]/.test(sanitizedEmail);
  
  return {
    hasAtSymbol,
    hasDomain,
    hasValidLength,
    isValidFormat,
    hasNoSqlKeywords,
    hasNoControlChars,
    sanitized: sanitizedEmail,
    isValid: isValidFormat && hasValidLength && hasNoSqlKeywords && hasNoControlChars
  };
};

// Username validation function with enhanced security
export const validateUsername = (username: string) => {
  // Sanitize input first
  const sanitizedUsername = sanitizeInput(username);
  
  const minLength = sanitizedUsername.length >= 3;
  const maxLength = sanitizedUsername.length <= 20;
  // Only allow alphanumeric characters and underscores
  const validChars = /^[a-zA-Z0-9_]+$/.test(sanitizedUsername);
  
  // Additional security checks
  const hasNoSqlKeywords = !/(union|select|insert|update|delete|drop|create|alter|exec|script|admin|root|system)/i.test(sanitizedUsername);
  const hasNoControlChars = !/[\x00-\x1F\x7F]/.test(sanitizedUsername);
  const startsWithLetter = /^[a-zA-Z]/.test(sanitizedUsername);
  
  return {
    minLength,
    maxLength,
    validChars,
    hasNoSqlKeywords,
    hasNoControlChars,
    startsWithLetter,
    sanitized: sanitizedUsername,
    isValid: minLength && maxLength && validChars && hasNoSqlKeywords && hasNoControlChars && startsWithLetter
  };
};

// Check if signup response indicates existing user
export const isExistingUser = (data: any) => {
  if (!data || !data.user) return false;
  
  return (
    (Array.isArray(data.user.identities) && data.user.identities.length === 0) ||
    (typeof data.user.user_metadata === 'object' && Object.keys(data.user.user_metadata).length === 0)
  );
};

// ============================================================================
// FORM VALIDATION HELPERS
// ============================================================================

// Form validation errors helper with enhanced security
export const getFormValidationErrors = (
  email: string,
  username: string,
  password: string,
  confirmPassword: string
) => {
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);
  const usernameValidation = validateUsername(username);

  // Email validation error
  if (!emailValidation.isValid) {
    if (!email.trim()) {
      return 'Email is required';
    } else if (!emailValidation.hasAtSymbol) {
      return 'Email must contain @ symbol';
    } else if (!emailValidation.hasDomain) {
      return 'Email must have a valid domain';
    } else if (!emailValidation.hasNoSqlKeywords) {
      return 'Email contains invalid characters';
    } else {
      return 'Please enter a valid email address';
    }
  }

  // Password validation error
  if (!passwordValidation.isValid) {
    if (!password.trim()) {
      return 'Password is required';
    } else if (!passwordValidation.hasNoSqlKeywords) {
      return 'Password contains invalid characters';
    } else if (!passwordValidation.hasNoControlChars) {
      return 'Password contains invalid characters';
    } else {
      return 'Password must meet all requirements above';
    }
  }

  // Password match validation
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }

  // Username validation error
  if (!usernameValidation.isValid) {
    if (!username.trim()) {
      return 'Username is required';
    } else if (!usernameValidation.startsWithLetter) {
      return 'Username must start with a letter';
    } else if (!usernameValidation.hasNoSqlKeywords) {
      return 'Username contains reserved words';
    } else {
      return 'Username must be 3-20 characters, letters, numbers, and underscores only';
    }
  }

  return null; // No errors
};

// Check if sign-up form is valid
export const isSignUpFormValid = (
  email: string,
  username: string,
  password: string,
  confirmPassword: string
): boolean => {
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);
  const usernameValidation = validateUsername(username);
  const passwordsMatch = password === confirmPassword;
  
  return emailValidation.isValid && 
         passwordValidation.isValid && 
         usernameValidation.isValid && 
         passwordsMatch && 
         confirmPassword.length > 0;
};

// Check if sign-in form is valid
export const isSignInFormValid = (email: string, password: string): boolean => {
  const emailValidation = validateEmail(email);
  return emailValidation.isValid && password.trim().length > 0;
};

// Get password hint color based on validation strength
export const getPasswordHintColor = (password: string): string => {
  if (!password) return '#F5E6D3'; // Default when no password
  
  const passwordValidation = validatePassword(password);
  switch (passwordValidation.strength) {
    case 'weak': return '#F5A5A5'; // Red for weak
    case 'medium': return '#F5E6D3'; // Light for medium
    case 'strong': return '#D4AF37'; // Gold for strong
    case 'very strong': return '#A3D4A0'; // Green for very strong
    default: return '#F5E6D3';
  }
};

// Get password requirements text
export const getPasswordRequirementsText = (password: string): string => {
  if (!password) {
    return 'Password must be at least 6 characters with uppercase, lowercase, number, and special character.';
  }

  const passwordValidation = validatePassword(password);
  const missingCriteria = [];
  
  if (!passwordValidation.minLength) missingCriteria.push('6+ characters');
  if (!passwordValidation.hasUppercase) missingCriteria.push('uppercase letter');
  if (!passwordValidation.hasLowercase) missingCriteria.push('lowercase letter');
  if (!passwordValidation.hasNumber) missingCriteria.push('number');
  if (!passwordValidation.hasSpecialChar) missingCriteria.push('special character (!@#$%^&*...)');
  
  if (passwordValidation.isValid) {
    return `✅ Password is ${passwordValidation.strength}! All requirements met.`;
  } else {
    return `Need: ${missingCriteria.join(', ')}`;
  }
};

// ============================================================================
// WORLD NAME VALIDATION FUNCTIONS
// ============================================================================

export interface WorldNameValidationResult {
  isValid: boolean;
  sanitizedName: string;
  errors: string[];
}

/**
 * Validates and sanitizes a world name input
 * @param name - The raw world name input
 * @param originalName - Optional original name for comparison (used in edit scenarios)
 * @returns Validation result with sanitized name and any errors
 */
export function validateWorldName(name: string, originalName?: string): WorldNameValidationResult {
  const errors: string[] = [];
  
  // Step 1: Basic sanitization - trim whitespace
  let sanitizedName = name.trim();
  
  // Step 2: Length validation
  if (sanitizedName.length === 0) {
    errors.push('World name cannot be empty');
  } else if (sanitizedName.length < 2) {
    errors.push('World name must be at least 2 characters long');
  } else if (sanitizedName.length > 50) {
    errors.push('World name must be 50 characters or less');
    sanitizedName = sanitizedName.substring(0, 50); // Truncate if too long
  }
  
  // Step 3: Character validation - allow alphanumeric, spaces, and safe special characters
  const allowedCharPattern = /^[a-zA-Z0-9\s\-_'.(),!&]*$/;
  if (!allowedCharPattern.test(sanitizedName)) {
    errors.push('World name contains invalid characters. Only letters, numbers, spaces, and basic punctuation allowed');
  }
  
  // Step 4: SQL injection pattern detection
  const sqlInjectionPatterns = [
    /['";]/g,                    // Single/double quotes, semicolons
    /--/g,                       // SQL comments
    /\/\*/g,                     // SQL comments
    /\*\//g,                     // SQL comments
    /\bunion\b/gi,              // UNION attacks
    /\bselect\b/gi,             // SELECT statements
    /\binsert\b/gi,             // INSERT statements
    /\bupdate\b/gi,             // UPDATE statements
    /\bdelete\b/gi,             // DELETE statements
    /\bdrop\b/gi,               // DROP statements
    /\balter\b/gi,              // ALTER statements
    /\bexec\b/gi,               // EXEC statements
    /\bscript\b/gi,             // Script tags
    /[<>]/g,                     // HTML/XML tags
  ];
  
  // Remove potentially dangerous patterns
  let cleanName = sanitizedName;
  sqlInjectionPatterns.forEach(pattern => {
    if (pattern.test(cleanName)) {
      errors.push('World name contains potentially unsafe characters');
      cleanName = cleanName.replace(pattern, '');
    }
  });
  
  // Step 5: Remove excessive whitespace
  cleanName = cleanName.replace(/\s+/g, ' ').trim();
  
  // Step 6: Check if name changed during sanitization
  if (cleanName !== sanitizedName && errors.length === 0) {
    // Only add this error if we haven't already flagged unsafe characters
    errors.push('World name was automatically cleaned for safety');
  }
  
  // Step 7: Check for unchanged name in edit scenarios
  if (originalName && cleanName === originalName.trim()) {
    errors.push('New world name must be different from the current name');
  }
  
  // Step 8: Final length check after cleaning
  if (cleanName.length < 2 && errors.length === 0) {
    errors.push('World name too short after cleaning');
  }
  
  return {
    isValid: errors.length === 0,
    sanitizedName: cleanName,
    errors
  };
}

/**
 * Creates a sanitized onChange handler for world name inputs
 * @param setValue - The state setter function
 * @param onValidationChange - Optional callback for validation state changes
 * @returns A function that can be used as onChangeText for TextInput
 */
export function createWorldNameChangeHandler(
  setValue: (value: string) => void,
  onValidationChange?: (result: WorldNameValidationResult) => void
) {
  return (text: string) => {
    const result = validateWorldName(text);
    setValue(result.sanitizedName);
    
    if (onValidationChange) {
      onValidationChange(result);
    }
  };
}

/**
 * Checks if a world name is valid for submission
 * @param name - The world name to validate
 * @param originalName - Optional original name for edit scenarios
 * @returns True if the name is valid for submission
 */
export function isValidWorldNameForSubmission(name: string, originalName?: string): boolean {
  const result = validateWorldName(name, originalName);
  return result.isValid && result.sanitizedName.length >= 2;
}