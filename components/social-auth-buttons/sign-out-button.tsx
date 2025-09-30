import React from 'react';
import { supabase } from '../../lib/supabase';
import PrimaryButton from '../custom_components/PrimaryButton';

async function onSignOutButtonPress() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
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