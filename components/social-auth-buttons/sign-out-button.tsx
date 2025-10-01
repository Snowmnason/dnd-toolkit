import React from 'react';
import { AuthStateManager } from '../../lib/auth-state';
import { supabase } from '../../lib/supabase';
import PrimaryButton from '../custom_components/PrimaryButton';

async function onSignOutButtonPress() {
  try {
    // Clear Supabase session
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out from Supabase:', error);
    }
    
    // Clear local auth state
    await AuthStateManager.clearAuthState();
    console.log('✅ Successfully signed out');
  } catch (error) {
    console.error('Error during sign out:', error);
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