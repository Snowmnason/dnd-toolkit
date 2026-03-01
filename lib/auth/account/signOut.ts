/**
 * Re-export signOutUser from auth-manager.
 * This file exists for backwards compatibility — consumers can import from
 * either '@/lib/auth/account/signOut' or '@/lib/auth' (via auth-manager).
 */
export { signOutUser } from "../auth-manager";
