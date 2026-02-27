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
  
  // Simple, safe email regex to prevent ReDoS attacks
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
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
// PASSWORD UI HELPERS (for strength display)
// ============================================================================

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
    return ' ';
  }

  const passwordValidation = validatePassword(password);
  const missingCriteria = [];
  
  if (!passwordValidation.minLength) missingCriteria.push('6+ characters');
  if (!passwordValidation.hasUppercase) missingCriteria.push('uppercase letter');
  if (!passwordValidation.hasLowercase) missingCriteria.push('lowercase letter');
  if (!passwordValidation.hasNumber) missingCriteria.push('number');
  if (!passwordValidation.hasSpecialChar) missingCriteria.push('special character (!@#$%^&*...)');
  
  if (passwordValidation.isValid) {
    return `✅ Looks great! All requirements met.`;
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

  // Step 1: Basic trim (trailing spaces removed on submit/typing)
  let working = (name ?? '').trim();

  // Step 2: Silently strip dangerous delimiter characters (not keywords)
  // We allow words like "delete" or "insert"; we only remove characters that could break queries/HTML.
  const dangerousChars = /['"`;<>]|--|\/\*|\*\//g;
  working = working.replace(dangerousChars, '');

  // Step 3: Collapse internal whitespace to single spaces
  working = working.replace(/\s+/g, ' ').trim();

  // Step 4: Enforce max length of 20 characters
  if (working.length > 20) {
    working = working.substring(0, 20);
  }

  // Step 5: Validate basic rules
  const allowedCharPattern = /^[a-zA-Z0-9\s\-_'.(),!&]*$/;
  if (working.length === 0) {
    errors.push('World name cannot be empty');
  } else if (working.length < 2) {
    errors.push('World name must be at least 2 characters long');
  } else if (!allowedCharPattern.test(working)) {
    errors.push('World name contains invalid characters. Only letters, numbers, spaces, and basic punctuation allowed');
  }

  // Step 6: If editing, ensure the name actually changes
  if (originalName && working === originalName.trim()) {
    errors.push('New world name must be different from the current name');
  }

  return {
    isValid: errors.length === 0,
    sanitizedName: working,
    errors,
  };
}