import { logger } from '@/lib'
import { getAuthProvider } from '@/lib/auth'
import { Button } from 'react-native'

async function onSignOutButtonPress() {
  try {
    const provider = await getAuthProvider();
    await provider.signOut();
    logger.category('auth').info('User signed out successfully');
  } catch (error) {
    logger.category('auth').error('Error signing out:', error)
  }
}

export default function SignOutButton() {
  return <Button title="Sign out" onPress={onSignOutButtonPress} />
}