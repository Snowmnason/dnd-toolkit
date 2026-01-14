import { Button } from '@/components/ui';
import { AuthStateManager, logger, supabase } from '@/lib';
import { useRouter } from 'expo-router';
import React from 'react';

function useSignOut() {
  const router = useRouter();
  
  const handleSignOut = async () => {
    try {
      // Clear Supabase session
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('auth', 'Error signing out from Supabase:', error);
      }
      
      // Clear local auth state
      await AuthStateManager.clearAuthState();
      logger.info('auth', 'Successfully signed out');
      
      // Navigate to index (which will show welcome screen)
      router.replace('/');
    } catch (error) {
      logger.error('auth', 'Error during sign out:', error);
    }
  };
  
  return handleSignOut;
}

export default function SignOutButton() {
  const handleSignOut = useSignOut();
  
  return (
    <Button
      style={{ paddingHorizontal: 20 }}
      onPress={handleSignOut}
    >
      Sign Out
    </Button>
  );
}