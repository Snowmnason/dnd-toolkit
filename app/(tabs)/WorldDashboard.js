import { StyleSheet, Text, View } from 'react-native';

export default function WorldDashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>World Dashboard</Text>
      <Text style={styles.subtitle}>Inside world placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
});
