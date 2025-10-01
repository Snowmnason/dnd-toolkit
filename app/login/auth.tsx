import { CoreColors } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import CustomModal from '../../components/CustomModal';
import CustomLoad from '../../components/custom_components/CustomLoad';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import TextInput from '../../components/custom_components/TextInput';
import { ThemedText } from '../../components/themed-text';
import { AuthStateManager } from '../../lib/auth-state';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const { action } = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [showEmailSentModal, setShowEmailSentModal] = useState(false);
  
  // Determine if we're in sign-up mode based on the passed parameter
  const isSignUp = action === 'signup';

  // Email helper functions
  const getEmailDomain = (email: string) => {
    return email.split('@')[1]?.toLowerCase();
  };

  const getEmailProvider = (domain: string) => {
    const providers: { [key: string]: { name: string; url: string } } = {
      'gmail.com': { name: 'Gmail', url: 'https://mail.google.com' },
      'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com' },
      'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com' },
      'live.com': { name: 'Outlook', url: 'https://outlook.live.com' },
      'yahoo.com': { name: 'Yahoo Mail', url: 'https://mail.yahoo.com' },
      'icloud.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
      'protonmail.com': { name: 'ProtonMail', url: 'https://mail.protonmail.com' },
      'aol.com': { name: 'AOL Mail', url: 'https://mail.aol.com' },
    };
    
    return providers[domain] || { name: 'Email', url: `https://${domain}` };
  };

  const openEmailApp = async (email: string) => {
    try {
      if (Platform.OS === 'web') {
        // Web: Open email provider in new tab
        const domain = getEmailDomain(email);
        const provider = getEmailProvider(domain);
        window.open(provider.url, '_blank');
      } else {
        // Mobile: Try native mail app first, fallback to web
        const mailtoUrl = 'mailto:';
        const canOpen = await Linking.canOpenURL(mailtoUrl);
        
        if (canOpen) {
          await Linking.openURL(mailtoUrl);
        } else {
          // Fallback to web provider
          const domain = getEmailDomain(email);
          const provider = getEmailProvider(domain);
          await Linking.openURL(provider.url);
        }
      }
    } catch (error) {
      console.error('Error opening email:', error);
      Alert.alert('Error', 'Could not open email app');
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = isSignUp 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        Alert.alert('Authentication Error', error.message);
      } else {
        if (isSignUp) {
          // Check if email confirmation is required
          if (data.session) {
            // User is immediately logged in (no email confirmation required)
            await AuthStateManager.setHasAccount(true);
            // Check if username is needed
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.user_metadata?.username) {
              router.replace('/login/complete-profile' as any);
            } else {
              router.replace('/select/world-selection');
            }
          } else {
            // Email confirmation required - show confirmation screen
            setConfirmationEmail(email);
            setShowEmailConfirmation(true);
          }
        } else {
          // Sign in successful
          await AuthStateManager.setHasAccount(true);
          // Check if username is needed
          const { data: { user } } = await supabase.auth.getUser();
          if (!user?.user_metadata?.username) {
            router.replace('/login/complete-profile' as any);
          } else {
            router.replace('/select/world-selection');
          }
        }
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!confirmationEmail) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: confirmationEmail
      });
      
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setShowEmailSentModal(true);
      }
    } catch {
      Alert.alert('Error', 'Failed to resend email');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setShowEmailConfirmation(false);
    setConfirmationEmail('');
    setEmail('');
    setPassword('');
  };

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
      });

      if (error) {
        Alert.alert('Authentication Error', error.message);
      } else {
        // Save successful authentication state
        await AuthStateManager.setHasAccount(true);
        // Note: OAuth will redirect away, username check will happen on return
        // The profile completion will be handled by the auth state management
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error('Social auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      
      {/* Back Button */}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: 'transparent' }}>
        <PrimaryButton
          style={{ backgroundColor: 'rgba(139, 69, 19, 0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
          textStyle={{ color: CoreColors.textPrimary, fontSize: 14, fontWeight: '500' }}
          onPress={() => showEmailConfirmation ? handleChangeEmail() : router.replace('/login/welcome')}
        >
          ← Back
        </PrimaryButton>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'transparent' }}>
        
        {showEmailConfirmation ? (
          // ==========================================
          // 📧 EMAIL CONFIRMATION SCREEN
          // ==========================================
          // 📱 MOBILE: Full-screen confirmation with touch-friendly buttons
          // 🖥️ DESKTOP: Same experience but with mouse interaction
          // Both platforms get the same clean, responsive layout
          <>
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
              {confirmationEmail}
            </ThemedText>

            <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 14, opacity: 0.7, color: '#F5E6D3', lineHeight: 20, paddingHorizontal: 20 }}>
              Click the link in your email to activate your account, then come back here to sign in.
            </ThemedText>

            {/* ==========================================
                🔄 FALLBACK OPTIONS - Same for both platforms
                ========================================== */}
            <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
              {/* � Quick Email Access Button */}
              <PrimaryButton
                style={{ width: '100%', backgroundColor: '#D4AF37', paddingVertical: 16, borderRadius: 8 }}
                textStyle={{ color: '#2f353d', fontSize: 16, fontWeight: '600' }}
                onPress={() => openEmailApp(confirmationEmail)}
              >
                📧 Open {getEmailProvider(getEmailDomain(confirmationEmail)).name}
              </PrimaryButton>

              {/* �📨 Resend Email Button */}
              <PrimaryButton
                style={{ width: '100%', backgroundColor: '#8B4513', paddingVertical: 16, borderRadius: 8 }}
                textStyle={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}
                onPress={handleResendEmail}
                disabled={loading}
              >
                {loading ? (
                  <CustomLoad />
                ) : (
                  'Resend Email'
                )}
              </PrimaryButton>

              {/* ✏️ Change Email Button */}
              <PrimaryButton
                style={{ width: '100%', backgroundColor: 'rgba(139, 69, 19, 0.15)', borderWidth: 1, borderColor: '#8B4513', paddingVertical: 12, borderRadius: 8 }}
                textStyle={{ color: '#F5E6D3', fontSize: 14, fontWeight: '500' }}
                onPress={handleChangeEmail}
              >
                Use Different Email
              </PrimaryButton>

              {/* ✅ Already Confirmed Button */}
              <PrimaryButton
                style={{ width: '100%', backgroundColor: '#4285F4', paddingVertical: 12, borderRadius: 8 }}
                textStyle={{ color: '#FFF', fontSize: 14, fontWeight: '500' }}
                onPress={() => router.replace('/login/auth?action=signin' as any)}
              >
                Already Confirmed? Sign In
              </PrimaryButton>
            </View>

            {/* 💡 Helpful tip for both platforms */}
            <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
              Check your spam folder if you don&apos;t see the email in a few minutes
            </ThemedText>
          </>
        ) : (
          // ==========================================
          // 🔐 NORMAL LOGIN/SIGNUP FORM
          // ==========================================
          // 📱 MOBILE: Touch-optimized form with virtual keyboard support
          // 🖥️ DESKTOP: Mouse and keyboard friendly with same responsive design
          // Both platforms share identical authentication flow
          <>
            <ThemedText 
              type="title" 
              style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3', fontSize: 32, fontWeight: '700' }}
            >
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </ThemedText>
            
            <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 16, opacity: 0.8, color: '#F5E6D3', lineHeight: 22, paddingHorizontal: 20 }}>
              {isSignUp 
                ? 'Join the adventure and sync your worlds across devices'
                : 'Sign in to access your saved worlds and characters'
              }
            </ThemedText>

            {/* ==========================================
                📝 FORM INPUTS - Cross-platform
                ========================================== */}
            <View style={{ width: '100%', maxWidth: 300, marginBottom: 30, backgroundColor: 'transparent' }}>
              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ marginBottom: 16 }}
              />
              
              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={{ marginBottom: 16 }}
              />
            </View>

            {/* ==========================================
                🔘 ACTION BUTTONS - Same experience both platforms
                ========================================== */}
            <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
              {/* Primary Auth Button */}
              <PrimaryButton
                style={{ width: '100%', backgroundColor: '#8B4513', paddingVertical: 16, borderRadius: 8 }}
                textStyle={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}
                onPress={handleAuth}
                disabled={loading}
              >
                {loading ? (
                  <CustomLoad />
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </PrimaryButton>

              {/* 🌐 Social Auth Buttons - OAuth works seamlessly on both platforms */}
              <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                <PrimaryButton
                  style={{ flex: 1, backgroundColor: '#000', paddingVertical: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  textStyle={{ color: '#FFF', fontSize: 14, fontWeight: '500', marginLeft: 8 }}
                  onPress={() => handleSocialAuth('apple')}
                  disabled={loading}
                >
                  🍎 Apple
                </PrimaryButton>
                
                <PrimaryButton
                  style={{ flex: 1, backgroundColor: '#4285F4', paddingVertical: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  textStyle={{ color: '#FFF', fontSize: 14, fontWeight: '500', marginLeft: 8 }}
                  onPress={() => handleSocialAuth('google')}
                  disabled={loading}
                >
                  🔵 Google
                </PrimaryButton>
              </View>

              {/* 🔄 Switch Mode Button */}
              <PrimaryButton
                style={{ width: '100%', backgroundColor: 'rgba(139, 69, 19, 0.15)', borderWidth: 1, borderColor: '#8B4513', paddingVertical: 12, borderRadius: 8 }}
                textStyle={{ color: '#F5E6D3', fontSize: 13, fontWeight: '500' }}
                onPress={() => router.push(isSignUp ? '/login/auth?action=signin' : '/login/auth?action=signup')}
                disabled={loading}
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </PrimaryButton>
            </View>

            <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
              Secure authentication powered by Supabase
            </ThemedText>
          </>
        )}
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