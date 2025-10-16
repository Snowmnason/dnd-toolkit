import { supabase } from '@/lib/database/supabase'
import { logger } from '@/lib/utils/logger'
import React from 'react'
import { Button } from 'react-native'

async function onSignOutButtonPress() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    logger.error('auth', 'Error signing out:', error)
  }
}

export default function SignOutButton() {
  return <Button title="Sign out" onPress={onSignOutButtonPress} />
}