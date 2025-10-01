import { CoreColors } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [showEmailExistsModal, setShowEmailExistsModal] = useState(false);
  const [waitingResend, setwaitingResend] = useState('Resend Email');
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [bad, good, great] = ['#F5E6D3', '#D4AF37', '#A3D4A0'];
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Determine if we're in sign-up mode based on the passed parameter
  const isSignUp = action === 'signup';

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Password validation function
  const validatePassword = (password: string) => {
    const minLength = password.length >= 6;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    const criteriaCount = [minLength, hasUppercase, hasLowercase, hasNumber].filter(Boolean).length;
    
    return {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      criteriaCount,
      isValid: criteriaCount >= 4,
      strength: criteriaCount === 0 ? 'weak' : criteriaCount <= 2 ? 'weak' : criteriaCount === 3 ? 'medium' : 'strong'
    };
  };
  
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(email);
    const hasAtSymbol = email.includes('@');
    const hasDomain = email.split('@')[1]?.includes('.') ?? false;
    const hasValidLength = email.length >= 5; // minimum: a@b.c

    return {
      hasAtSymbol,
      hasDomain,
      hasValidLength,
      isValidFormat,
      isValid: isValidFormat && hasValidLength
    };
  };

  // Get email hint color based on validation
  const getEmailHintColor = () => {
    if (!email) return bad; // Default color when no email
    const validation = validateEmail(email);
    
    if (validation.isValid) {
      return great; // Valid email = green
    } else if (validation.hasAtSymbol && validation.hasDomain) {
      return good; // Has @ and domain but maybe formatting issues = yellow
    } else {
      return bad; // Missing basic requirements = red
    }
  };

  // Get password hint color based on validation
  const getPasswordHintColor = () => {
    if (!password) return bad; // Default color when no password
    const validation = validatePassword(password);
    
    switch (validation.strength) {
      case 'weak': return bad;
      case 'medium': return good;
      case 'strong': return great;
      default: return bad;
    }
  };

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
        // Mobile: Only try native mail app, no fallbacks
        const mailtoUrl = 'mailto:';
        const canOpen = await Linking.canOpenURL(mailtoUrl);
        
        if (canOpen) {
          await Linking.openURL(mailtoUrl);
        }
        // If no mail app available, do nothing - user will handle it themselves
      }
    } catch (error) {
      console.error('Error opening email:', error);
      // Only show error alert if something actually went wrong during the attempt
      if (Platform.OS === 'web') {
        Alert.alert('Error', 'Could not open email app');
      }
    }
  };

  const handleAuth = async () => {
    // Clear any previous errors and start comprehensive loading
    setAuthError('');
    setLoading(true);
    setIsAuthenticating(true);
    
    try {
      // Wait for definitive response from Supabase
      const { data, error } = isSignUp 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      // Give Supabase a moment to process (prevents race conditions)
      await new Promise(resolve => setTimeout(resolve, 500));

      if (error) {
        // Check for email already exists error during sign up - more comprehensive detection
        if (isSignUp && (
            error.message.includes('User already registered') || 
            error.message.includes('already registered') || 
            error.message.includes('already been registered') ||
            error.message.includes('email address not available') ||
            error.message.includes('duplicate key value') ||
            error.code === '23505' // PostgreSQL unique constraint violation
          )) {
          setShowEmailExistsModal(true);
          return;
        }
        
        // Show specific error messages based on error type
        if (error.message.includes('Invalid login credentials')) {
          setAuthError(isSignUp 
            ? 'Account creation failed. Please check your email format and password requirements.'
            : 'Incorrect email or password. Please try again.'
          );
        } else if (error.message.includes('Email not confirmed')) {
          setAuthError('RESEND_EMAIL'); // Special flag for resend functionality
        } else if (error.message.includes('User not found')) {
          setAuthError('No account found with this email. Please check your email or create an account.');
        } else if (error.message.includes('Password')) {
          setAuthError('Password does not meet requirements. Please check and try again.');
        } else {
          setAuthError(error.message || 'Authentication failed. Please try again.');
        }
      } else {
        if (isSignUp) {
          // Check if we got a valid response - no user creation means email already exists
          if (!data || !data.user) {
            setShowEmailExistsModal(true);
            return;
          }
          
          // Double-check user was actually created with correct email
          if (data.user.email !== email.toLowerCase()) {
            setShowEmailExistsModal(true);
            return;
          }
          
          // IMPORTANT: Check if this is an existing user trying to sign up again
          // Existing users have empty role, user_metadata, and identities arrays
          if (!data.user.role || 
              (Array.isArray(data.user.identities) && data.user.identities.length === 0) ||
              (typeof data.user.user_metadata === 'object' && Object.keys(data.user.user_metadata).length === 0)) {
            // This indicates the email already exists
            setShowEmailExistsModal(true);
            return;
          }
          
          // Verify the user was actually created with correct ID and email
          if (data.user && data.user.id) {
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
            // Fallback: something went wrong with user creation
            setAuthError('Account creation failed. Please try again.');
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
      console.error('Auth error:', error);
      setAuthError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
      setIsAuthenticating(false);
    }
  };

  const handleResendEmail = async () => {
    if (!confirmationEmail || isCountingDown) return;
    
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
        
        // Start countdown and disable button
        setIsCountingDown(true);
        let countdown = 30;
        setwaitingResend(`(${countdown}s)`);
        
        timerRef.current = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            setwaitingResend(`(${countdown}s)`);
          } else {
            // Re-enable button and reset text
            setwaitingResend('Resend Email');
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

  const handleResendConfirmationFromError = async (email: string) => {
    setIsResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });
      
      if (error) {
        setAuthError(`Failed to resend email: ${error.message}`);
      } else {
        setAuthError('✅ Confirmation email sent! Check your inbox.');
        // Clear the success message after 3 seconds
        setTimeout(() => setAuthError(''), 3000);
      }
    } catch {
      setAuthError('Failed to resend confirmation email. Please try again.');
    } finally {
      setIsResendingEmail(false);
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
          style={{ 
            backgroundColor: isAuthenticating ? 'rgba(139, 69, 19, 0.1)' : 'rgba(139, 69, 19, 0.2)', 
            paddingHorizontal: 16, 
            paddingVertical: 8, 
            borderRadius: 6,
            opacity: isAuthenticating ? 0.5 : 1
          }}
          textStyle={{ color: CoreColors.textPrimary, fontSize: 14, fontWeight: '500' }}
          onPress={() => showEmailConfirmation ? handleChangeEmail() : router.replace('/login/welcome')}
          disabled={isAuthenticating}
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
              <ThemedText 
                style={{ 
                  color: '#D4AF37', 
                  textDecorationLine: 'underline', 
                  fontSize: 14, 
                  opacity: 0.8,
                  cursor: 'pointer'
                }}
                onPress={() => openEmailApp(confirmationEmail)}
              >
                Click the link in your email
              </ThemedText>
              <ThemedText style={{ fontSize: 14, opacity: 0.7, color: '#F5E6D3' }}> to activate your account, then come back here to sign in.</ThemedText>
            </ThemedText>

            {/* ==========================================
                🔄 FALLBACK OPTIONS - Same for both platforms
                ========================================== */}
            <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
              {/* 📨 Resend Email Button */}
              <PrimaryButton
                style={{ width: '100%', backgroundColor: '#8B4513', paddingVertical: 16, borderRadius: 8 }}
                textStyle={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}
                onPress={handleResendEmail}
                disabled={loading || isResendingEmail || isCountingDown}
              >
                {loading ? (
                  <CustomLoad />
                ) : (
                  waitingResend
                )}
              </PrimaryButton>

              {/* Bottom Row: Change Email + Already Confirmed */}
              <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                {/* ✏️ Change Email Button */}
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

                {/* ✅ Already Confirmed Button */}
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
                : 'Sign in to access your saved worlds and characters. New to D&D Toolkit? Create an account below.'
              }
            </ThemedText>

            {/* ==========================================
                📝 FORM INPUTS - Cross-platform
                ========================================== */}
            <View style={{ width: '100%', maxWidth: 300, marginBottom: 15, backgroundColor: 'transparent' }}>
              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={(text: string) => {
                  setEmail(text);
                  if (authError) setAuthError(''); // Clear error when user types
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ marginBottom: 8 }}
                editable={!isAuthenticating}
              />
              
              {/* Password Input with Show/Hide Toggle */}
              <View style={{ position: 'relative', marginBottom: 8 }}>
                <TextInput
                  placeholder="Password"
                  value={password}
                  onChangeText={(text: string) => {
                    setPassword(text);
                    if (authError) setAuthError(''); // Clear error when user types
                  }}
                  secureTextEntry={!showPassword}
                  style={{ paddingRight: 50 }} // Make room for the eye icon
                  editable={!isAuthenticating}
                />
                
                {/* Eye Toggle Button */}
                <PrimaryButton
                  style={{ 
                    position: 'absolute', 
                    right: 4, 
                    top: 3, 
                    backgroundColor: 'transparent', 
                    paddingHorizontal: 4, 
                    paddingVertical: 4,
                    minWidth: 24,
                    maxWidth: 30,
                    height: 32,
                    opacity: isAuthenticating ? 0.5 : 1
                  }}
                  textStyle={{ color: '#D4AF37', fontSize: 16 }}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isAuthenticating}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </PrimaryButton>
              </View>

              {/* Authentication Error Display */}
              {authError && (
                <View style={{ marginBottom: 8 }}>
                  {authError === 'RESEND_EMAIL' ? (
                    // Special case for email confirmation error with resend functionality
                    <View style={{ 
                      backgroundColor: 'rgba(245, 230, 211, 0.1)',
                      padding: 12,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: 'rgba(245, 230, 211, 0.2)'
                    }}>
                      <ThemedText 
                        style={{ 
                          textAlign: 'center', 
                          fontSize: 12, 
                          color: bad, 
                          fontWeight: '500', 
                          lineHeight: 16,
                          opacity: 0.9,
                          marginBottom: 8
                        }}
                      >
                        ❌ Please check your email and click the confirmation link before signing in.
                      </ThemedText>
                      
                      <PrimaryButton
                        style={{ 
                          backgroundColor: '#D4AF37', 
                          paddingVertical: 8, 
                          paddingHorizontal: 12, 
                          borderRadius: 4,
                          alignSelf: 'center'
                        }}
                        textStyle={{ color: '#2f353d', fontSize: 11, fontWeight: '600' }}
                        onPress={() => handleResendConfirmationFromError(email)}
                        disabled={isResendingEmail}
                      >
                        {isResendingEmail ? '📧 Sending...' : '📧 Resend Email'}
                      </PrimaryButton>
                    </View>
                  ) : (
                    // Regular error display
                    <ThemedText 
                      style={{ 
                        textAlign: 'center', 
                        fontSize: 12, 
                        color: authError.startsWith('✅') ? great : bad, 
                        fontWeight: '500', 
                        lineHeight: 16,
                        opacity: 0.9,
                        backgroundColor: 'rgba(245, 230, 211, 0.1)',
                        padding: 8,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: 'rgba(245, 230, 211, 0.2)'
                      }}
                    >
                      {authError.startsWith('✅') ? authError : `❌ ${authError}`}
                    </ThemedText>
                  )}
                </View>
              )}

              {/* Forgot Password Link - Only on Sign In */}
              {!isSignUp && (
                <ThemedText
                  style={{ textAlign: 'right', fontSize: 13, color: '#D4AF37', fontWeight: '500', marginBottom: 4, cursor: 'pointer' }}
                  onPress={() => router.push('/login/auth?action=reset-password')}
                >
                  Forgot Password?
                </ThemedText>
              )}

              {/* Password Requirements - Only on Sign Up */}
              {isSignUp && (
                <View style={{ marginBottom: 4 }}>
                  <ThemedText 
                    style={{ 
                      textAlign: 'left', 
                      fontSize: 11, 
                      color: getPasswordHintColor(), 
                      fontWeight: '500', 
                      lineHeight: 16,
                      opacity: 0.9
                    }}
                  >
                    {password ? (() => {
                      const validation = validatePassword(password);
                      const missingCriteria = [];
                      if (!validation.minLength) missingCriteria.push('6+ characters');
                      if (!validation.hasUppercase) missingCriteria.push('uppercase letter');
                      if (!validation.hasLowercase) missingCriteria.push('lowercase letter');
                      if (!validation.hasNumber) missingCriteria.push('number');
                      
                      if (validation.isValid) {
                        return '✅ Password meets all requirements!';
                      } else {
                        return `Need: ${missingCriteria.join(', ')}`;
                      }
                    })() : 'Password must be at least 6 characters with at least 1 uppercase letter, 1 lowercase letter, and 1 number.'}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* ==========================================
                🔘 ACTION BUTTONS - Same experience both platforms
                ========================================== */}
            <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
              {/* Primary Auth Button */}
              <PrimaryButton
                style={{ 
                  width: '100%', 
                  backgroundColor: (() => {
                    if (loading || isAuthenticating) return '#6c757d';
                    if (!email || !password) return '#6c757d';
                    if (!validateEmail(email).isValid) return '#6c757d'; // Always require valid email
                    if (isSignUp && !validatePassword(password).isValid) return '#6c757d'; // Only require valid password for signup
                    return '#8B4513';
                  })(),
                  paddingVertical: 16, 
                  borderRadius: 8,
                  opacity: (() => {
                    if (loading || isAuthenticating) return 0.6;
                    if (!email || !password) return 0.6;
                    if (!validateEmail(email).isValid) return 0.6; // Always require valid email
                    if (isSignUp && !validatePassword(password).isValid) return 0.6; // Only require valid password for signup
                    return 1;
                  })()
                }}
                textStyle={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}
                onPress={handleAuth}
                disabled={loading || isAuthenticating || !email || !password || !validateEmail(email).isValid || (isSignUp && !validatePassword(password).isValid)}
              >
                {loading || isAuthenticating ? (
                  <CustomLoad />
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </PrimaryButton>

              {/* 🌐 Social Auth Buttons - OAuth works seamlessly on both platforms 
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
                style={{ 
                  width: '100%', 
                  backgroundColor: 'rgba(139, 69, 19, 0.15)', 
                  borderWidth: 1, 
                  borderColor: '#8B4513', 
                  paddingVertical: 12, 
                  borderRadius: 8,
                  opacity: isAuthenticating ? 0.5 : 1
                }}
                textStyle={{ color: '#F5E6D3', fontSize: 13, fontWeight: '500' }}
                onPress={() => router.push(isSignUp ? '/login/auth?action=signin' : '/login/auth?action=signup')}
                disabled={loading || isAuthenticating}
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

      {/* Email Already Exists Modal */}
      <CustomModal
        visible={showEmailExistsModal}
        onClose={() => setShowEmailExistsModal(false)}
        title="Account Already Exists! 🤔"
        message={`An account with ${email} already exists. Would you like to sign in instead?`}
        buttons={[
          {
            text: 'Cancel',
            onPress: () => setShowEmailExistsModal(false),
            style: 'cancel'
          },
          {
            text: 'Sign In',
            onPress: () => {
              setShowEmailExistsModal(false);
              router.push('/login/auth?action=signin');
            },
            style: 'primary'
          }
        ]}
      />
    </View>
  );
}