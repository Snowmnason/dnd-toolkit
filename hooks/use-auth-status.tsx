import { logger, supabase } from '@/lib/';
import { useEffect, useState } from 'react';

export function useAuthStatus() {
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Use cached session instead of making network call
        const { data: { session } } = await supabase.auth.getSession();
        setIsUserLoggedIn(session?.user !== null);
      } catch (error) {
        logger.error('auth', 'Error checking auth status:', error);
        setIsUserLoggedIn(false);
      }
    };

    checkAuthStatus();
  }, []);

  return { isUserLoggedIn };
}