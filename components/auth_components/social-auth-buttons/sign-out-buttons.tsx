import { logger } from '@/lib'
// SUPABASE_AUTH: Direct auth operations — to be migrated to getAuthProvider() in Track D
import { supabase } from '@/lib/database/supabase'
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