import {
  AuthActionGroup,
  AuthBackButtonContainer,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthCaption,
  AuthModal,
  AuthRoot,
  AuthSubTitle,
  AuthTitle
} from '@/components/auth_components';
import { Body } from '@/components/ui';
import { useAuthStateListener } from '@/hooks/auth';
import { useNavigation } from '@/hooks/navigation';
import { logger } from '@/hooks/utils';
import { openEmailApp } from '@/validation';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';

export default function EmailConfirmationScreen() {
  const navigate = useNavigation();
  const { email } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [showEmailSentModal, setShowEmailSentModal] = useState(false);
  const [waitingResend, setWaitingResend] = useState('Resend Email');
  const [isCountingDown, setIsCountingDown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const userEmail = Array.isArray(email) ? email[0] : email || '';

  // Use hook with callback to detect email confirmation
  const { resendConfirmation } = useAuthStateListener((session) => {
    logger.category('auth').debug('Auth state change:', session?.email);
    
    // When session becomes available with matching email, user confirmed email
    if (session && session.email === userEmail) {
      // User successfully confirmed email
      // Redirect to sign-in so they can manually complete their account setup
      logger.category('auth').info('Email confirmed, redirecting to sign-in');
      navigate.replace('/login/sign-in');
    }
  });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleResendEmail = async () => {
    if (!userEmail || isCountingDown) return;
    
    setLoading(true);
    
    // Use hook's convenience action (handles rate limiting and error mapping)
    const result = await resendConfirmation(userEmail);
    
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to resend email');
      setLoading(false);
      return;
    }
    
    // Success: show modal and start countdown
    setShowEmailSentModal(true);
    setLoading(false);
    setIsCountingDown(true);
    let countdown = 30;
    setWaitingResend(`(${countdown}s)`);
    
    timerRef.current = setInterval(() => {
      countdown--;
      logger.category('auth').debug('Countdown:', countdown);
      if (countdown > 0) {
        setWaitingResend(`(${countdown}s)`);
      } else {
        // Re-enable button and reset text
        logger.category('auth').debug('Timer finished, re-enabling button');
        setWaitingResend('Resend Email');
        setIsCountingDown(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 1000);
  };

  // TODO: Clarify email-change intent and implementation
  // Currently just navigates back to welcome; unclear if this should:
  // 1. Allow changing the email on the current signup flow
  // 2. Simply allow retrying with a different email
  // Disabled pending clarification and proper implementation
  // const handleChangeEmail = () => {
  //   const target = buildNavigationTarget('/login/welcome', {}, []);
  //   navigate.replace(target as any);
  // };

  return (
    <AuthRoot>
      {/* 🔙 Back Button */}
      <AuthBackButtonContainer>
        <AuthButtonBack
          text="← Back"
          onPress={() => navigate.replace('/')}
          disabled={loading}
        />
      </AuthBackButtonContainer>

      {/* 🧠 Header */}
      <AuthTitle>Check Your Email</AuthTitle>

      <AuthSubTitle style={{ marginBottom: 30 }}>
        We sent a confirmation link to:
      </AuthSubTitle>

      <AuthSubTitle fontSize={18} color="#D4AF37">
        {userEmail}
      </AuthSubTitle>

      <AuthSubTitle>
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
      </AuthSubTitle>

      {/* 🔘 Action Buttons */}
      <AuthActionGroup>
        {/* Resend Email Button */}
        <AuthButton
          text={waitingResend}
          onPress={handleResendEmail}
          disabled={isCountingDown}
          loading={loading}
        />

        {/* Bottom Row: Already Confirmed */}
        <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
          {/* TODO: Re-enable "Use Different Email" after clarifying intent */}
          {/* <AuthButton
            text='Use Different Email'
            bg="rgba(139, 69, 19, 0.15)"
            borderColor="#8B4513"
            textColor="#F5E6D3"
            style={{ flex: 1, width: 'auto' }}
            onPress={handleChangeEmail}
          /> */}

          {/* Already Confirmed Button */}
          <AuthButton
            bg="#4285F4"
            text='Already Confirmed?'
            textColor="#FFF"
            onPress={() => navigate.replace('/login/sign-in')}
            style={{ flex: 1, width: 'auto' }}
          />
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