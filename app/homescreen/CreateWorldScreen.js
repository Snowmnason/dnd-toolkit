import { useState } from 'react';
import { Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import PrimaryButton from '../components/baseComps';
import MapCanvas from '../components/MapCanvas';
import styles from './HomeScreen.styles';

const tabletopSystems = [
  'D&D 5e',
  'Pathfinder',
  'Call of Cthulhu',
  'Custom',
];

export default function CreateWorldScreen({ navigation }) {
  const [worldName, setWorldName] = useState('');
  const [isDM, setIsDM] = useState(true);
  const [system, setSystem] = useState(tabletopSystems[0]);
  const [description, setDescription] = useState('');

  // Desktop/tablet layout
  const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';

  return (
    <View style={styles.container}>
      {/* Left Panel: World Creation Form */}
      <View style={styles.leftPanel}>
        <ScrollView>
          <Text style={styles.worldListTitle}>Create New World</Text>
          <TextInput
            style={[styles.worldItem, { marginBottom: 16 }]}
            placeholder="World Name"
            value={worldName}
            onChangeText={setWorldName}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.worldItemText}>DM</Text>
            <Switch value={isDM} onValueChange={setIsDM} style={{ marginHorizontal: 8 }} />
            <Text style={styles.worldItemText}>Player</Text>
          </View>
          <Text style={styles.worldItemText}>Tabletop System</Text>
          {/* Simple dropdown for web, Picker for native */}
          {Platform.OS === 'web' ? (
            <select
              style={{ marginBottom: 16, padding: 8, borderRadius: 8 }}
              value={system}
              onChange={e => setSystem(e.target.value)}
            >
              {tabletopSystems.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <TextInput
              style={[styles.worldItem, { marginBottom: 16 }]}
              value={system}
              onChangeText={setSystem}
              placeholder="Tabletop System"
            />
          )}
          <Text style={styles.worldItemText}>Description</Text>
          <TextInput
            style={[styles.worldItem, { height: 100, textAlignVertical: 'top', marginBottom: 16 }]}
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
            <PrimaryButton
                onPress={() => navigation.goBack()}
            >
                Cancel
            </PrimaryButton>
            <PrimaryButton
                onPress={() => {navigation.reset({index: 0, routes: [{ name: 'Main' }]})}}
            >
                Create
            </PrimaryButton>
          </View>
        </ScrollView>
      </View>
      {/* Only render right panel on desktop */}
      {isDesktop && (
        <View style={styles.rightPanel}>
          <MapCanvas />
        </View>
      )}
    </View>
  );
}
