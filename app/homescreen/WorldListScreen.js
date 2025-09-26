import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import styles from './HomeScreen.styles';

export default function WorldListScreen({ navigation }) {
  const worlds = Array.from({ length: 10 }).map((_, i) => `World Placeholder ${i + 1}`);

  return (
    <View style={styles.container}>
      <Text style={styles.worldListTitle}>Worlds</Text>
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
      <TouchableOpacity style={styles.createButton}>
        <Text style={styles.createButtonText}>Create New World</Text>
      </TouchableOpacity>
    </View>
  );
}
