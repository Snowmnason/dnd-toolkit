import { CoreColors } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import AuthButton from '../../components/custom_components/auth_components/AuthButton';
import { openEmailApp } from '../../components/custom_components/auth_components/emailUtils';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import CustomModal from '../../components/CustomModal';
import { ThemedText } from '../../components/themed-text';
import { AuthStateManager } from '../../lib/auth-state';
import { supabase } from '../../lib/supabase';

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user?.email === userEmail) {
        // User successfully confirmed email and is now signed in
        await AuthStateManager.setHasAccount(true);
        
        // Check if username is needed
        if (!session.user?.user_metadata?.username) {
          router.replace('/login/complete-profile' as any);
        } else {
          router.replace('/select/world-selection');
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
      } else {
        setShowEmailSentModal(true);
        
        // Start countdown and disable button
        setIsCountingDown(true);
        let countdown = 30;
        setWaitingResend(`(${countdown}s)`);
        
        timerRef.current = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            setWaitingResend(`(${countdown}s)`);
          } else {
            // Re-enable button and reset text
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
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      
      {/* Back Button */}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: 'transparent' }}>
        <PrimaryButton
          style={{ 
            backgroundColor: 'rgba(139, 69, 19, 0.2)', 
            paddingHorizontal: 16, 
            paddingVertical: 8, 
            borderRadius: 6
          }}
          textStyle={{ color: CoreColors.textPrimary, fontSize: 14, fontWeight: '500' }}
          onPress={handleChangeEmail}
        >
          ← Back
        </PrimaryButton>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'transparent' }}>
        
        <ThemedText 
          type="title" 
          style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3', fontSize: 32, fontWeight: '700' }}
        >
          Check Your Email
        </ThemedText>
        
        <ThemedText style={{ marginBottom: 30, textAlign: 'center', fontSize: 16, opacity: 0.8, color: '#F5E6D3', lineHeight: 22, paddingHorizontal: 20 }}>
          We sent a confirmation link to:
        </ThemedText>

        <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 18, color: '#D4AF37', fontWeight: '600', paddingHorizontal: 20 }}>
          {userEmail}
        </ThemedText>

        <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 14, opacity: 0.7, color: '#F5E6D3', lineHeight: 20, paddingHorizontal: 20 }}>
          <ThemedText 
            style={{ 
              color: '#D4AF37', 
              textDecorationLine: 'underline', 
              fontSize: 14, 
              opacity: 0.8,
              cursor: 'pointer'
            }}
            onPress={() => openEmailApp(userEmail)}
          >
            Click the link in your email
          </ThemedText>
          <ThemedText style={{ fontSize: 14, opacity: 0.7, color: '#F5E6D3' }}> to activate your account. You&apos;ll be automatically signed in!</ThemedText>
        </ThemedText>

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Resend Email Button */}
          <AuthButton
            title={waitingResend}
            onPress={handleResendEmail}
            disabled={isCountingDown}
            loading={loading}
          />

          {/* Bottom Row: Change Email + Already Confirmed */}
          <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
            {/* Change Email Button */}
            <PrimaryButton
              style={{ 
                flex: 1, 
                backgroundColor: 'rgba(139, 69, 19, 0.15)', 
                borderWidth: 1, 
                borderColor: '#8B4513', 
                paddingVertical: 12, 
                borderRadius: 8 
              }}
              textStyle={{ color: '#F5E6D3', fontSize: 13, fontWeight: '500' }}
              onPress={handleChangeEmail}
            >
              Use Different Email
            </PrimaryButton>

            {/* Already Confirmed Button */}
            <PrimaryButton
              style={{ 
                flex: 1, 
                backgroundColor: '#4285F4', 
                paddingVertical: 12, 
                borderRadius: 8 
              }}
              textStyle={{ color: '#FFF', fontSize: 13, fontWeight: '500' }}
              onPress={() => router.replace('/login/auth?action=signin' as any)}
            >
              Already Confirmed?
            </PrimaryButton>
          </View>
        </View>

        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          After confirming your email, you&apos;ll be automatically signed in and redirected to complete your profile.
        </ThemedText>
      </View>

      {/* Email Sent Success Modal */}
      <CustomModal
        visible={showEmailSentModal}
        onClose={() => setShowEmailSentModal(false)}
        title="Email Sent! 📧"
        message="Check your inbox for the confirmation link to complete your account setup."
        buttons={[
          {
            text: 'Got it!',
            onPress: () => setShowEmailSentModal(false),
            style: 'primary'
          }
        ]}
      />
    </View>
  );
}