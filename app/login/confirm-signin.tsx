import { AuthError, AuthInput } from '@/components/auth_components';
import { Body, BodyLogin, Button, Caption, SubTitle, Title } from '@/components/ui';
import { useSignInForm } from '@/lib';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

export default function SignInScreen() {
  const router = useRouter();
  
  const {
    // Form data
    email,
    password,
    loading,
    authError,
    showPassword,
    
    // Validation state
    emailValidation,
    isFormValid,
    
    // Handlers
    handleSignIn,
    handleEmailChange,
    handlePasswordChange,
    setShowPassword,
  } = useSignInForm();


  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'transparent' }}>
        
        <Title>Welcome Back</Title>
        
       <BodyLogin opacity={0.8}>
          Continue the sign-in process to confirm your account and adventures.
        </BodyLogin>

        {/* Form Inputs */}
        <View style={{ width: '100%', maxWidth: 300, marginBottom: 15, backgroundColor: 'transparent' }}>
          <AuthInput
            placeholder="Email"
            value={email}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
            style={{
              borderColor: !emailValidation.isValid && email.length > 0 ? '#dc3545' : undefined,
              borderWidth: !emailValidation.isValid && email.length > 0 ? 2 : undefined
            }}
          />
          
          <AuthInput
            placeholder="Password"
            value={password}
            onChangeText={handlePasswordChange}
            secureTextEntry={true}
            editable={!loading}
            showPasswordToggle={true}
            onTogglePassword={() => setShowPassword(!showPassword)}
            showPassword={showPassword}
            style={{
              borderColor: !password.trim() && password.length > 0 ? '#dc3545' : undefined,
              borderWidth: !password.trim() && password.length > 0 ? 2 : undefined
            }}
          />

          {/* Forgot Password Link - TODO: Add forgot password screen */}
          <SubTitle color='#D4AF37' cursor='pointer' align='right' style={{ marginBottom: 4, marginTop: -14 }}
            onPress={() => router.push('/login/forgot-password')}
          >
            Forgot Password?
          </SubTitle>

        </View>

        {/* Error Display */}
        <View style={{ width: '100%', maxWidth: 300 }}>
          <AuthError error={authError} />
        </View>

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Sign In Button */}
          <Button
            variant="auth"
            text="Sign In"
            onPress={handleSignIn}
            disabled={!isFormValid} loading={loading}
          />
          
          {/* Back to Welcome Button */}
          <Body align='center' color='#D4AF37' deco='underline' style={{ marginTop: 8 }} onPress={() => router.replace('/login/welcome')}>
            ← Back to Welcome
          </Body>
        </View>

        <Body variant="semi" fontSize="$sm" color='#F5E6D3' align='center' opacity={0.6}
          style={{ marginTop: 30, lineHeight: 18, paddingHorizontal: 20 }}>
          Secure authentication powered by Supabase
        </Body>

        <Caption color='#F5E6D3' align='center' style={{ marginTop: 8, opacity: 0.5, lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </Caption>
      </View>
    </View>
  );
}