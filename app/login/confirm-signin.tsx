import { useRouter } from 'expo-router';
import { View } from 'react-native';
import AuthButton from '../../components/auth_components/AuthButton';
import AuthInput from '../../components/auth_components/AuthInput';
import { ThemedText } from '../../components/themed-text';
import { useSignInForm } from '../../lib/auth';

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
        
        <ThemedText 
          type="title" 
          style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3', fontSize: 32, fontWeight: '700' }}
        >
          Welcome Back
        </ThemedText>
        
        <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 16, opacity: 0.8, color: '#F5E6D3', lineHeight: 22, paddingHorizontal: 20 }}>
          Continue the sign-in process to confirm your account and adventures.
        </ThemedText>

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
          <ThemedText
            style={{ textAlign: 'right', fontSize: 13, color: '#D4AF37', fontWeight: '500', marginBottom: 4, cursor: 'pointer', marginTop: -14 }}
            onPress={() => router.push('/login/forgot-password')}
          >
            Forgot Password?
          </ThemedText>

        </View>

        {/* Error Display */}
        {authError && (
          <View style={{ 
            width: '100%', 
            maxWidth: 300, 
            backgroundColor: 'rgba(220, 53, 69, 0.1)', 
            borderColor: '#dc3545', 
            borderWidth: 1, 
            borderRadius: 8, 
            padding: 12, 
            marginBottom: 16 
          }}>
            <ThemedText style={{ 
              color: '#dc3545', 
              fontSize: 14, 
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {authError}
            </ThemedText>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Sign In Button */}
          <AuthButton
            title="Sign In"
            onPress={handleSignIn}
            disabled={!isFormValid}
            loading={loading}
          />
          
          {/* Back to Welcome Button */}
          <ThemedText
            style={{ 
              textAlign: 'center', 
              fontSize: 14, 
              color: '#D4AF37', 
              fontWeight: '500',
              marginTop: 8,
              textDecorationLine: 'underline'
            }}
            onPress={() => router.replace('/login/welcome')}
          >
            ← Back to Welcome
          </ThemedText>
        </View>

        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          Secure authentication powered by Supabase
        </ThemedText>
        
        <ThemedText style={{ marginTop: 8, textAlign: 'center', fontSize: 11, opacity: 0.5, color: '#F5E6D3', lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </ThemedText>
      </View>
    </View>
  );
}