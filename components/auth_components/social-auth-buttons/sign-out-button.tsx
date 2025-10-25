import { Button } from '@/components/ui';
import { AuthStateManager, logger, supabase } from '@/lib';
import React from 'react';

async function onSignOutButtonPress() {
  try {
    // Clear Supabase session
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error('auth', 'Error signing out from Supabase:', error);
    }
    
    // Clear local auth state
    await AuthStateManager.clearAuthState();
    logger.info('auth', 'Successfully signed out');
  } catch (error) {
    logger.error('auth', 'Error during sign out:', error);
  }
}

export default function SignOutButton() {
  return (
    <Button
      style={{ paddingHorizontal: 20 }}
      onPress={onSignOutButtonPress}
    >
      Sign Out
    </Button>
  );
}