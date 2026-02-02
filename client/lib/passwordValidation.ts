export const PASSWORD_REQUIREMENTS = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'hasUppercase', label: 'One uppercase letter' },
  { key: 'hasLowercase', label: 'One lowercase letter' },
  { key: 'hasNumber', label: 'One number' },
];

export interface PasswordChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  checks: PasswordChecks;
}

export function validatePassword(password: string): PasswordValidationResult {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  const errors: string[] = [];
  if (!checks.minLength) errors.push('At least 8 characters');
  if (!checks.hasUppercase) errors.push('One uppercase letter');
  if (!checks.hasLowercase) errors.push('One lowercase letter');
  if (!checks.hasNumber) errors.push('One number');

  return { isValid: errors.length === 0, errors, checks };
}

export function mapPasswordError(errorMessage: string): string {
  if (
    errorMessage.toLowerCase().includes('weak') ||
    errorMessage.toLowerCase().includes('easy to guess')
  ) {
    return 'Please choose a different password. Try adding more unique characters or avoiding common words.';
  }
  return errorMessage;
}

export function mapAuthError(errorMessage: string): string {
  if (errorMessage.includes('Invalid login credentials')) {
    return 'Invalid email or password';
  }
  if (errorMessage.includes('User already registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (errorMessage.includes('Email not confirmed')) {
    return 'Please check your email to confirm your account';
  }
  return mapPasswordError(errorMessage);
}
