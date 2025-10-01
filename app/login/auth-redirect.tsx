import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function AuthRedirect() {
  const router = useRouter();
  const { action } = useLocalSearchParams();

  useEffect(() => {
    // Redirect to appropriate new screen based on action
    if (action === 'signin') {
      router.replace('./login/sign-in');
    } else if (action === 'signup') {
      router.replace('./login/sign-up');
    } else {
      // Default to sign-in
      router.replace('./login/sign-in');
    }
  }, [action, router]);

  // Return null while redirecting
  return null;
}