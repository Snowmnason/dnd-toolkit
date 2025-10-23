import { logger, supabase } from '@/lib/';
import { useEffect, useState } from 'react';

export function useAuthStatus() {
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setIsUserLoggedIn(user !== null);
      } catch (error) {
        logger.error('auth', 'Error checking auth status:', error);
        setIsUserLoggedIn(false);
      }
    };

    checkAuthStatus();
  }, []);

  return { isUserLoggedIn };
}