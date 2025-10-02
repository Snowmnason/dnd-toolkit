import { supabase } from '@/lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { AuthStateManager } from '../../../lib/auth-state';
import PrimaryButton from '../../custom_components/PrimaryButton';

async function onAppleButtonPress() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    console.log('Apple sign in successful:', credential);

    if (credential.identityToken) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        console.error('Error signing in with Apple:', error);
        return;
      }

      if (data) {
        console.log('Apple authentication successful:', data);
        
        // Save successful authentication state
        await AuthStateManager.setHasAccount(true);
        
        // Check if username is needed (same logic as other auth flows)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.user_metadata?.username) {
          router.replace('/login/sign-up');
        } else {
          router.replace('/select/world-selection');
        }
      }
    }
  } catch (error) {
    console.error('Apple sign in error:', error);
  }
}

export default function AppleSignInButton() {
  // Only show on iOS devices
  if (Platform.OS !== 'ios') { 
    return null; 
  }

  return (
    <PrimaryButton
      style={{ 
        width: '100%', 
        backgroundColor: '#000000', 
        paddingVertical: 16, 
        borderRadius: 8, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}
      textStyle={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}
      onPress={onAppleButtonPress}
    >
      🍎 Apple
    </PrimaryButton>
  );
}