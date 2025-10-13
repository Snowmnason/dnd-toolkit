import React from 'react';
import { AuthStateManager } from '../../lib/auth-state';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/utils/logger';
import PrimaryButton from '../custom_components/PrimaryButton';

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
    <PrimaryButton
      style={{ paddingHorizontal: 20 }}
      textStyle={{}}
      onPress={onSignOutButtonPress}
    >
      Sign Out
    </PrimaryButton>
  );
}