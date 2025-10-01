import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, View } from 'react-native';
import PrimaryButton from '../../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../../components/themed-text';
import { ThemedView } from '../../../components/themed-view';
import { Spacing } from '../../../constants/theme';

export default function WorldDetail() {
  const { worldName } = useLocalSearchParams<{ worldName: string }>();
  const router = useRouter();
  const selectedMapImage = require('../../../assets/images/Miku.png');

  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', padding: Spacing.md }}>
      <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText type="title" style={{
          marginBottom: Spacing.md,
          textAlign: 'center',
          fontWeight: '600',
          fontSize: 58
        }}>
          {worldName}
        </ThemedText>
        <Image
          source={selectedMapImage}
          resizeMode="contain"
          style={{ width: '100%', height: '70%', borderRadius: 12, zIndex: 1 }}
        />
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '60%',
          marginBottom: Spacing.md,
        }}>
          <PrimaryButton 
            style={{}}
            textStyle={{}}
            onPress={() => {/* TODO: delete */}}
          >
            Delete
          </PrimaryButton>
          <PrimaryButton
            style={{}}
            textStyle={{}}
            onPress={() => {
              router.replace('/main/mobile');
            }}
          >
            Open
          </PrimaryButton>
        </View>
      </View>
    </ThemedView>
  );
}