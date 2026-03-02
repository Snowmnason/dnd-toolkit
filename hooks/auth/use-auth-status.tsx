import { getCurrentSession } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { useEffect, useState } from 'react';

export function useAuthStatus() {
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const session = await getCurrentSession();
        setIsUserLoggedIn(session !== null);
      } catch (error) {
        logger.category('auth').error('Error checking auth status:', error);
        setIsUserLoggedIn(false);
      }
    };

    checkAuthStatus();
  }, []);

  return { isUserLoggedIn };
}