import { useState } from 'react';
import { Platform, ScrollView, Switch, View } from 'react-native';
import Dropdown from '../../components/custom_components/Dropdown';
import MapCanvas from '../../components/custom_components/MapCanvas'; // placeholder
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import TextInputComponent from '../../components/custom_components/TextInput';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

const tabletopSystems = ['D&D 5e', 'Pathfinder', 'Call of Cthulhu', 'Custom'];

export default function CreateWorldScreen({ navigation }) {
  const [worldName, setWorldName] = useState('');
  const [isDM, setIsDM] = useState(true);
  const [system, setSystem] = useState(tabletopSystems[0]);
  const [description, setDescription] = useState('');

  const isDesktop =
    Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';

  return (
    <ThemedView style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
      {/* Left Panel: Form */}
      <View style={{ flex: 1, padding: 16 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <ThemedText type="title" style={{ marginBottom: 16 }}>
            Create New World
          </ThemedText>

          {/* World Name */}
          <ThemedText>Name of World</ThemedText>
          <TextInputComponent
            placeholder="World Name"
            value={worldName}
            onChangeText={setWorldName}
            style={{ marginBottom: 16 }}
          />

          {/* DM / Player Toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <ThemedText>DM</ThemedText>
            <Switch value={isDM} onValueChange={setIsDM} style={{ marginHorizontal: 8 }} />
            <ThemedText>Player</ThemedText>
          </View>

          {/* Tabletop System */}
          <ThemedText>Tabletop System</ThemedText>
          <Dropdown value={system} onChange={setSystem} options={tabletopSystems} />

          {/* Description */}
          <ThemedText>Description</ThemedText>
          <TextInputComponent
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            style={{
              height: 100,
              textAlignVertical: 'top',
              marginBottom: 16,
            }}
          />

          {/* Import Image (mobile only here) */}
          {!isDesktop && (
            <PrimaryButton style={{ marginBottom: 16 }} onPress={() => {}}>
              Import Image
            </PrimaryButton>
          )}

          {/* Action Buttons */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 16,
            }}
          >
            <PrimaryButton onPress={() => navigation.goBack()}>Cancel</PrimaryButton>
            <PrimaryButton
              disabled={worldName === ''}
              onPress={() => {
                if (isDesktop) {
                  navigation.reset({ index: 0, routes: [{ name: 'Main' }] })
                }else{
                  navigation.reset({ index: 0, routes: [{ name: 'MainMobile' }] })
                }
              }}
            >
              Create
            </PrimaryButton>
          </View>
        </ScrollView>
      </View>

      {/* Right Panel (desktop only) */}
      {isDesktop && (
        <View style={{ flex: 4, borderLeftWidth: 1, borderLeftColor: '#ccc' }}>
          {/* Canvas placeholder */}
          <MapCanvas />

          {/* Import image button */}
          <PrimaryButton style={{ margin: 16 }} onPress={() => {}}>
            Import Image
          </PrimaryButton>

          {/* Future drawing tools placeholder */}

        </View>
      )}
    </ThemedView>
  );
}
