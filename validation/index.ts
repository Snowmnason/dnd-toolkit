// Auth Validation
export {
    getPasswordHintColor,
    getPasswordRequirementsText,
    isExistingUser,
    sanitizeInput,
    validateEmail,
    validatePassword,
    validateUsername,
    validateWorldName,
    type WorldNameValidationResult
} from "./validation";

export * from './auth.schema';
export * from './world.schema';

export { getEmailDomain, getEmailProvider, openEmailApp } from "./emailUtils";

