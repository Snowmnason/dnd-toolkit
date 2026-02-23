import { getAuthProvider } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { useEffect, useState } from 'react';

export function useAuthStatus() {
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Use cached session instead of making network call
        const session = await (await getAuthProvider()).getSession();
        setIsUserLoggedIn(session !== null);
      } catch (error) {
        logger.error('auth', 'Error checking auth status:', error);
        setIsUserLoggedIn(false);
      }
    };

    checkAuthStatus();
  }, []);

  return { isUserLoggedIn };
}