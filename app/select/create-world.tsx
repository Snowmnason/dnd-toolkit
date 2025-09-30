import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Switch, View } from 'react-native';
import Dropdown from '../../components/custom_components/Dropdown';
import MapCanvas from '../../components/custom_components/MapCanvas'; // placeholder
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import TextInputComponent from '../../components/custom_components/TextInput';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { AuthStateManager } from '../../lib/auth-state';
import { worldsDB } from '../../lib/database/worlds';
import { supabase } from '../../lib/supabase';

const tabletopSystems = ['D&D 5e', 'Pathfinder', 'Call of Cthulhu', 'Custom'];

export default function CreateWorldScreen() {
  const [worldName, setWorldName] = useState('');
  const [isDM, setIsDM] = useState(true);
  const [system, setSystem] = useState(tabletopSystems[0]);
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean | null>(null);
  const router = useRouter();

  const isDesktop =
    Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';

  // Check if user is logged in on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const authState = await AuthStateManager.getAuthState();
        setIsUserLoggedIn(user !== null && !authState.skipAuth);
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsUserLoggedIn(false);
      }
    };

    checkAuthStatus();
  }, []);

  const handleCreateWorld = async () => {
    if (!worldName.trim()) {
      Alert.alert('Error', 'Please enter a world name');
      return;
    }

    // Check if user is logged in
    if (!isUserLoggedIn) {
      Alert.alert(
        'Sign In Required', 
        'You need to sign in to create and save worlds. Would you like to sign in now?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Sign In',
            onPress: () => router.push('/login/welcome')
          }
        ]
      );
      return;
    }

    setIsCreating(true);
    
    try {
      const newWorld = await worldsDB.create({
        name: worldName.trim(),
        description: description.trim() || '',
        system: system,
        is_dm: isDM
      });

      Alert.alert(
        'Success!', 
        `World "${newWorld.name}" created and saved to your account!`,
        [
          {
            text: 'OK',
            onPress: () => router.replace(isDesktop ? '/main/desktop' : '/main/mobile')
          }
        ]
      );
    } catch (error) {
      console.error('Create world error:', error);
      Alert.alert(
        'Error', 
        'Failed to create world. Please check your connection and try again.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
      {/* Left Panel: Form */}
      <View style={{ flex: 1, padding: 16 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ backgroundColor: 'rgba(139, 69, 19, 0.9)', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, marginBottom: 24, borderWidth: 2, borderColor: '#D4AF37', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 }}>
            <ThemedText type="title" style={{ textAlign: 'center', fontWeight: '700', color: '#F5E6D3', textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 }}>
              Create New World
            </ThemedText>
          </View>

          {/* World Name */}
          <ThemedText style={{ fontWeight: '600', fontSize: 16, textShadowColor: '#D4AF37', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, marginBottom: 8 }}>Name of World</ThemedText>
          <TextInputComponent
            placeholder="World Name"
            value={worldName}
            onChangeText={setWorldName}
            style={{ marginBottom: 16 }}
          />

          {/* DM / Player Toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <ThemedText style={{ fontWeight: '600', fontSize: 16, textShadowColor: '#D4AF37', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}>DM</ThemedText>
            <Switch value={isDM} onValueChange={setIsDM} style={{ marginHorizontal: 8 }} />
            <ThemedText style={{ fontWeight: '600', fontSize: 16, textShadowColor: '#D4AF37', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}>Player</ThemedText>
          </View>

          {/* Tabletop System */}
          <ThemedText style={{ fontWeight: '600', fontSize: 16, textShadowColor: '#D4AF37', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, marginBottom: 8 }}>Tabletop System</ThemedText>
          <Dropdown 
            value={system} 
            onChange={setSystem}
            options={tabletopSystems}
            placeholder="Select a tabletop system"
          />

          {/* Description */}
          <ThemedText style={{ fontWeight: '600', fontSize: 16, textShadowColor: '#D4AF37', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, marginBottom: 8 }}>Description</ThemedText>
          <TextInputComponent
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            style={{ height: 100, textAlignVertical: 'top', marginBottom: 16, }}/>

          {/* Import Image (mobile only here) */}
          {!isDesktop && (
            <PrimaryButton style={{ marginBottom: 16 }} textStyle={{}}onPress={() => {}}>
              Import Image
            </PrimaryButton>
          )}

          {/* Action Buttons */}
          <View
            style={{flexDirection: 'row',justifyContent: 'space-between',marginTop: 16,}}>
            <PrimaryButton 
              style={{}}
              textStyle={{}}
              onPress={() => router.back()}
            >
              Cancel
            </PrimaryButton>
            <PrimaryButton style={{}} textStyle={{}}
              disabled={worldName.trim() === '' || isCreating}
              onPress={handleCreateWorld}
            >
              {isCreating ? 'Creating...' : 'Create'}
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
          <PrimaryButton 
            style={{ margin: 16 }} 
            textStyle={{}}
            onPress={() => {}}
          >
            Import Image
          </PrimaryButton>

          {/* Future drawing tools placeholder */}

        </View>
      )}
    </ThemedView>
  );
}
