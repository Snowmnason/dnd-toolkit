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

// Check if signup response indicates existing user
export const isExistingUser = (data: any) => {
  if (!data || !data.user) return false;
  
  return (
    !data.user.role || 
    (Array.isArray(data.user.identities) && data.user.identities.length === 0) ||
    (typeof data.user.user_metadata === 'object' && Object.keys(data.user.user_metadata).length === 0)
  );
};