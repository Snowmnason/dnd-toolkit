import {
  AuthActionGroup,
  AuthBackButtonContainer,
  AuthBody,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthCaption,
  AuthModal,
  AuthRoot,
  AuthTitle
} from '@/components/auth_components';
import { Body } from '@/components/ui';
import { AuthStateManager, logger, openEmailApp, supabase, usersDB } from '@/lib';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';





export default function EmailConfirmationScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [showEmailSentModal, setShowEmailSentModal] = useState(false);
  const [waitingResend, setWaitingResend] = useState('Resend Email');
  const [isCountingDown, setIsCountingDown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const userEmail = Array.isArray(email) ? email[0] : email || '';

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Listen for auth state changes (for auto-signin after email confirmation)
  useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
  logger.debug('email-confirmation', 'Auth state change:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user?.email === userEmail) {
        // User successfully confirmed email and is now signed in
        await AuthStateManager.setHasAccount(true);
        
        // Check if user has completed their profile
        try {
          const profile = await usersDB.getCurrentUser();
          if (profile && profile.username) {
            // Profile is complete, go to world selection with userId
            router.replace({
              pathname: '/select/world-selection',
              params: { userId: profile.id }
            });
          } else {
            // Profile needs completion
            router.replace('/login/complete-profile');
          }
        } catch {
          // No profile exists, redirect to complete profile
          router.replace('/login/complete-profile');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [userEmail, router]);

  const handleResendEmail = async () => {
    if (!userEmail || isCountingDown) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail
      });
      
      if (error) {
        Alert.alert('Error', error.message);
        setLoading(false);
        return;
      } else {
        setShowEmailSentModal(true);
        
        // Start countdown and disable button immediately
        setLoading(false); // Stop loading spinner
        setIsCountingDown(true);
        let countdown = 30;
        setWaitingResend(`(${countdown}s)`);
        
        timerRef.current = setInterval(() => {
          countdown--;
          logger.debug('email-confirmation', 'Countdown:', countdown);
          if (countdown > 0) {
            setWaitingResend(`(${countdown}s)`);
          } else {
            // Re-enable button and reset text
            logger.debug('email-confirmation', 'Timer finished, re-enabling button');
            setWaitingResend('Resend Email');
            setIsCountingDown(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        }, 1000);
      }
    } catch {
      Alert.alert('Error', 'Failed to resend email');
      setLoading(false);
    }
    // Note: setLoading(false) is handled above in success case
  };

  const handleChangeEmail = () => {
    router.back();
  };

  return (
    <AuthRoot>
      {/* 🔙 Back Button */}
      <AuthBackButtonContainer>
        <AuthButtonBack
          text="← Back"
          onPress={() => router.replace('/login/welcome')}
          disabled={loading}
        />
      </AuthBackButtonContainer>

      {/* 🧠 Header */}
      <AuthTitle>Check Your Email</AuthTitle>

      <AuthBody style={{ marginBottom: 30 }}>
        We sent a confirmation link to:
      </AuthBody>

      <AuthBody fontSize={18} color="#D4AF37">
        {userEmail}
      </AuthBody>

      <AuthBody opacity={0.8}>
        <Body
          opacity={0.7}
          color="#D4AF37"
          deco="underline"
          cursor="pointer"
          onPress={() => openEmailApp(userEmail)}
        >
          Click the link in your email
        </Body>
        <Body opacity={0.7}>
          {' '}
          to activate your account. You&apos;ll be automatically signed in!
        </Body>
      </AuthBody>

      {/* 🔘 Action Buttons */}
      <AuthActionGroup>
        {/* Resend Email Button */}
        <AuthButton
          text={waitingResend}
          onPress={handleResendEmail}
          disabled={isCountingDown}
          loading={loading}
        />

        {/* Bottom Row: Change Email + Already Confirmed */}
        <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
          {/* Change Email Button */}
          <AuthButton
            bg="rgba(139, 69, 19, 0.15)"
            borderColor="#8B4513"
            textColor="#F5E6D3"
            style={{ flex: 1 }}
            onPress={handleChangeEmail}
          >
            Use Different Email
          </AuthButton>

          {/* Already Confirmed Button */}
          <AuthButton bg="#4285F4" textColor="#FFF" onPress={() => router.replace('/login/sign-in')}>
            Already Confirmed?
          </AuthButton>
        </View>
      </AuthActionGroup>

      {/* 🧩 Footer */}
      <AuthBodyFooter>
        After confirming your email, you&apos;ll be automatically signed in and can
        start your adventure!
      </AuthBodyFooter>

      <AuthCaption>
        © 2025 The Snow Post · Forged for storytellers & adventurers
      </AuthCaption>

      {/* 📬 Email Sent Success Modal */}
      <AuthModal
        visible={showEmailSentModal}
        onClose={() => setShowEmailSentModal(false)}
        title="Email Sent! 📧"
        message="Check your inbox for the confirmation link to complete your account setup."
        buttons={[
          {
            text: 'Got it!',
            onPress: () => setShowEmailSentModal(false),
            variant: 'primary',
          },
        ]}
      />
    </AuthRoot>
  )
}