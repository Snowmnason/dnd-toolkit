import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Switch, View } from 'react-native';
import CustomModal from '../../components/CustomModal';
import Dropdown from '../../components/custom_components/Dropdown';
import MapCanvas from '../../components/custom_components/MapCanvas'; // placeholder
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import TextInputComponent from '../../components/custom_components/TextInput';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { ComponentStyles, CoreColors, Spacing, createTextShadow } from '../../constants/theme';
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
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successWorldName, setSuccessWorldName] = useState('');
  const [showValidationModal, setShowValidationModal] = useState(false);
  const router = useRouter();

  const isDesktop =
    Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';

  // Check if user is logged in on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setIsUserLoggedIn(user !== null);
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsUserLoggedIn(false);
      }
    };

    checkAuthStatus();
  }, []);

  const handleCreateWorld = async () => {
    if (!worldName.trim()) {
      setShowValidationModal(true);
      return;
    }

    // Check if user is logged in
    if (!isUserLoggedIn) {
      setShowSignInModal(true);
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

      setSuccessWorldName(newWorld.name);
      setShowSuccessModal(true);
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
      <View style={{ flex: 1, padding: Spacing.md }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={ComponentStyles.card.container}>
            <ThemedText type="title" style={{
              textAlign: 'center',
              fontWeight: '700',
              color: CoreColors.textPrimary,
              ...createTextShadow(CoreColors.backgroundDark, { width: 2, height: 2 }, 4)
            }}>
              Create New World
            </ThemedText>
          </View>

          {/* World Name */}
          <ThemedText style={{
            fontWeight: '600',
            fontSize: 16,
            ...createTextShadow(CoreColors.secondary, { width: 1, height: 1 }, 2),
            marginBottom: Spacing.xs
          }}>
            Name of World
          </ThemedText>
          <TextInputComponent
            placeholder="World Name"
            value={worldName}
            onChangeText={setWorldName}
            style={{ marginBottom: Spacing.md }}
          />

          {/* DM / Player Toggle */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: Spacing.md
          }}>
            <ThemedText style={{
              fontWeight: '600',
              fontSize: 16,
              ...createTextShadow(CoreColors.secondary, { width: 1, height: 1 }, 2)
            }}>
              DM
            </ThemedText>
            <Switch
              value={isDM}
              onValueChange={setIsDM}
              style={{ marginHorizontal: Spacing.xs }}
            />
            <ThemedText style={{
              fontWeight: '600',
              fontSize: 16,
              ...createTextShadow(CoreColors.secondary, { width: 1, height: 1 }, 2)
            }}>
              Player
            </ThemedText>
          </View>

          {/* Tabletop System */}
          <ThemedText style={{
            fontWeight: '600',
            fontSize: 16,
            ...createTextShadow(CoreColors.secondary, { width: 1, height: 1 }, 2),
            marginBottom: Spacing.xs
          }}>
            Tabletop System
          </ThemedText>
          <Dropdown 
            value={system} 
            onChange={setSystem}
            options={tabletopSystems}
            placeholder="Select a tabletop system"
          />

          {/* Description */}
          <ThemedText style={{
            fontWeight: '600',
            fontSize: 16,
            ...createTextShadow(CoreColors.secondary, { width: 1, height: 1 }, 2),
            marginBottom: Spacing.xs
          }}>
            Description
          </ThemedText>
          <TextInputComponent
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            style={{
              height: 100,
              textAlignVertical: 'top',
              marginBottom: Spacing.md,
            }}
          />

          {/* Import Image (mobile only here) */}
          {!isDesktop && (
            <PrimaryButton
              style={{ marginBottom: Spacing.md }}
              textStyle={{}}
              onPress={() => {}}
            >
              Import Image
            </PrimaryButton>
          )}

          {/* Action Buttons */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: Spacing.md,
          }}>
            <PrimaryButton 
              style={{}}
              textStyle={{}}
              onPress={() => router.replace('/select/world-selection')}
            >
              Cancel
            </PrimaryButton>
            <PrimaryButton
              style={{}}
              textStyle={{}}
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
        <View style={{
          flex: 4,
          borderLeftWidth: 1,
          borderLeftColor: CoreColors.borderPrimary
        }}>
          {/* Canvas placeholder */}
          <MapCanvas />

          {/* Import image button */}
          <PrimaryButton 
            style={{ margin: Spacing.md }} 
            textStyle={{}}
            onPress={() => {}}
          >
            Import Image
          </PrimaryButton>

          {/* Future drawing tools placeholder */}

        </View>
      )}

      {/* Sign In Required Modal */}
      <CustomModal
        visible={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        title="Sign In Required"
        message="You need to sign in to create and save worlds. Would you like to sign in now?"
        buttons={[
          {
            text: 'Cancel',
            onPress: () => setShowSignInModal(false),
            style: 'cancel'
          },
          {
            text: 'Sign In',
            onPress: () => {
              setShowSignInModal(false);
              router.push('/login/welcome');
            },
            style: 'primary'
          }
        ]}
      />

      {/* Validation Modal */}
      <CustomModal
        visible={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        title="World Name Required"
        message="Please enter a name for your world before creating it."
        buttons={[
          {
            text: 'Got it',
            onPress: () => setShowValidationModal(false),
            style: 'primary'
          }
        ]}
      />

      {/* Success Modal */}
      <CustomModal
        visible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          router.replace(isDesktop ? '/main/desktop' : '/main/mobile');
        }}
        title="Success!"
        message={`World "${successWorldName}" created and saved to your account!`}
        buttons={[
          {
            text: 'Continue',
            onPress: () => {
              setShowSuccessModal(false);
              router.replace(isDesktop ? '/main/desktop' : '/main/mobile');
            },
            style: 'primary'
          }
        ]}
      />
    </ThemedView>
  );
}
