import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import PrimaryButton from '../../components/PrimaryButton';
import styles from '../HomeScreen.styles';

export default function WorldListScreen({ navigation }) {
  const worlds = Array.from({ length: 10 }).map((_, i) => `World Placeholder ${i + 1}`);

  return (
    <View style={styles.containerMobile}>
      <Text style={styles.worldListTitleMobile}>Worlds</Text>
      <ScrollView style={styles.worldList}>
        {worlds.map((worldName, i) => (
          <TouchableOpacity
            key={i}
            style={styles.worldItem}
            onPress={() => navigation.navigate('WorldDetail', { worldName })}
          >
            <Text style={styles.worldItemText}>{worldName}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
          <PrimaryButton
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 16,
              borderRadius: 14,
            }}
            onPress={() => {navigation.navigate('CreateWorld')}}
          >
            Create New World
          </PrimaryButton>
    </View>
  );
}
