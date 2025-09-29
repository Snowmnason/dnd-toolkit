import { useState } from 'react';
import { Platform, ScrollView, Switch, Text, View } from 'react-native';
import Dropdown from '../components/Dropdown';
import MapCanvas from '../components/MapCanvas';
import PrimaryButton from '../components/PrimaryButton';
import TextInputComponent from '../components/TextInput';
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
          <Text style={styles.worldItemText}>Name of World</Text>
          <TextInputComponent
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
          <Dropdown
            value={system}
            onChange={setSystem}
            options={tabletopSystems}
          />
          <Text style={styles.worldItemText}>Description</Text>
          <TextInputComponent
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            style={{ height: 100, textAlignVertical: 'top', marginBottom: 16 }}
          />
          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
            <PrimaryButton
                onPress={() => navigation.goBack()}
            >
                Cancel
            </PrimaryButton>
            <PrimaryButton
            disabled = {worldName === ''}
            //Save world to a json and create a new folder in app data with the world name
                onPress={() => {
                    // const worldData = {
                    //     name: worldName, / folder name
                    //     isDM,
                    //     system,
                    //     description,
                    //     createdAt: new Date().toISOString(),
                    // };
                    // Save worldData to a JSON file and create a new folder in app data
                    navigation.reset({index: 0, routes: [{ name: 'Main' }]})
                }}
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
