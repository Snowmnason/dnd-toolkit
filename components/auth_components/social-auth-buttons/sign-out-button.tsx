import { Button } from '@/components/ui';
import { AuthStateManager, logger } from '@/lib';
import { useRouter } from 'expo-router';
import React from 'react';

function useSignOut() {
  const router = useRouter();
  
  const handleSignOut = async () => {
    try {
      // Use centralized logout method
      await AuthStateManager.logout();
      
      // Navigate to index (which will show welcome screen)
      router.replace('/');
    } catch (error) {
      logger.category('auth').error('Error during sign out:', error);
      // Still redirect even if logout failed
      router.replace('/');
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