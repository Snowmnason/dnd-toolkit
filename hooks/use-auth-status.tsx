import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useAuthStatus() {
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setIsUserLoggedIn(user !== null);
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsUserLoggedIn(false);
      }
    };

    checkAuthStatus();
  }, []);

  return { isUserLoggedIn };
}