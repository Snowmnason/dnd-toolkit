import { AuthBackButtonContainer, AuthButtonBack } from '@/components/auth_components';
import { useNavigation } from '@/hooks/navigation';
import { $ } from '@/theme';
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function LoginLayout() {
  const navigate = useNavigation();

  return (
    <View style={{ flex: 1, /*backgroundColor: CoreColors.backgroundDark */ }}>
      <Stack 
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: $('background') || '#2f353d', ///MAYBE REPLACE WITH THEME TOKEN
          },
        }}
      />
      <AuthBackButtonContainer>
        <AuthButtonBack
          text="← Back"
          onPress={() => navigate.replace('/')}
        />
      </AuthBackButtonContainer>
    </View>
  );
}