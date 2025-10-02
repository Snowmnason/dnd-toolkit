// ============================================================================
// CORE VALIDATION FUNCTIONS
// ============================================================================

// Password validation function
export const validatePassword = (password: string) => {
  const minLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  
  const criteriaCount = [minLength, hasUppercase, hasLowercase, hasNumber].filter(Boolean).length;
  
  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    criteriaCount,
    isValid: criteriaCount >= 4,
    strength: criteriaCount === 0 ? 'weak' : criteriaCount <= 2 ? 'weak' : criteriaCount === 3 ? 'medium' : 'strong'
  };
};

// Email validation function
export const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidFormat = emailRegex.test(email);
  const hasAtSymbol = email.includes('@');
  const hasDomain = email.split('@')[1]?.includes('.') ?? false;
  const hasValidLength = email.length >= 5; // minimum: a@b.c

  return {
    hasAtSymbol,
    hasDomain,
    hasValidLength,
    isValidFormat,
    isValid: isValidFormat && hasValidLength
  };
};

// Username validation function
export const validateUsername = (username: string) => {
  const minLength = username.length >= 3;
  const maxLength = username.length <= 20;
  const validChars = /^[a-zA-Z0-9]+$/.test(username);
  
  return {
    minLength,
    maxLength,
    validChars,
    isValid: minLength && maxLength && validChars
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

// Form validation errors helper
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
    } else {
      return 'Please enter a valid email address';
    }
  }

  // Password validation error
  if (!passwordValidation.isValid) {
    if (!password.trim()) {
      return 'Password is required';
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
    } else {
      return 'Username must be 3-20 characters, letters and numbers only';
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
    case 'weak': return '#F5E6D3';
    case 'medium': return '#D4AF37';
    case 'strong': return '#A3D4A0';
    default: return '#F5E6D3';
  }
};

// Get password requirements text
export const getPasswordRequirementsText = (password: string): string => {
  if (!password) {
    return 'Password must be at least 6 characters with at least 1 uppercase letter, 1 lowercase letter, and 1 number.';
  }

  const passwordValidation = validatePassword(password);
  const missingCriteria = [];
  
  if (!passwordValidation.minLength) missingCriteria.push('6+ characters');
  if (!passwordValidation.hasUppercase) missingCriteria.push('uppercase letter');
  if (!passwordValidation.hasLowercase) missingCriteria.push('lowercase letter');
  if (!passwordValidation.hasNumber) missingCriteria.push('number');
  
  if (passwordValidation.isValid) {
    return '✅ Password meets all requirements!';
  } else {
    return `Need: ${missingCriteria.join(', ')}`;
  }
};