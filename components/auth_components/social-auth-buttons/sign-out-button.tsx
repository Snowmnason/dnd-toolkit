import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { AuthStateManager } from '../../../lib/auth-state';
import { supabase } from '../../../lib/database/supabase';
import { logger } from '../../../lib/utils/logger';

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
    <TouchableOpacity
      onPress={onSignOutButtonPress}
      style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#8B4513', borderRadius: 8 }}
      activeOpacity={0.8}
    >
      <Text style={{ color: '#F5E6D3', fontWeight: '600' }}>Sign Out</Text>
    </TouchableOpacity>
  );
}