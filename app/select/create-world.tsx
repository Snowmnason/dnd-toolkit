import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, Switch, View } from 'react-native';
import CreateWorldModals from '../../components/create-world/CreateWorldModals';
import Dropdown from '../../components/custom_components/Dropdown';
import MapCanvas from '../../components/custom_components/MapCanvas';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import TextInputComponent from '../../components/custom_components/TextInput';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { ComponentStyles, CoreColors, Spacing, createTextShadow } from '../../constants/theme';
import { useAuthStatus } from '../../hooks/use-auth-status';
import { useSuccessNavigation } from '../../hooks/use-success-navigation';
import { useWorldCreation } from '../../hooks/use-world-creation';

const tabletopSystems = ['D&D 5e', 'Pathfinder', 'Call of Cthulhu', 'Custom'];
const defaultMapImages = ["https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_MedRes.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgJm47wbufqY9yqRw_OLFJBtLEYYNGlCMMHWRozByIB4-SvH-6lwXPEI7L4LXhA1la-Ek0w7L_TU1wBkX4P7Z4fKmVQ2XAHuAmiF-4HYOGKWAZofbqc0e3pNca2dvU4HAWDuh8bg4y869M/s1600/Vlaroa1.jpg",
  "https://talaraska.com/wp-content/uploads/2024/01/text-1-hw-terrain-4275x2600-1.jpg",
  "https://images.squarespace-cdn.com/content/v1/5dadaf88e03a4e6bb69307dd/904f0cc0-7846-4576-ac91-176528727e4b/Vhaledhon+No+Text+Map+Blog.jpg",
 ];

export default function CreateWorldScreen() {
  // Form state
  const [worldName, setWorldName] = useState('');
  const [isDM, setIsDM] = useState(true);
  const [system, setSystem] = useState(tabletopSystems[0]);
  const [description, setDescription] = useState('');
  const [imageImported, setImageImported] = useState(false);
  
  // Modal state
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Fake image URL for testing - replace with your actual image logic
  const [mapIndex, setMapIndex] = useState(Math.floor(Math.random() * defaultMapImages.length));
  //const fakeImageUrl = "https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_MedRes.jpg";
  
  const router = useRouter();
  const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';
  
  // Custom hooks
  const { isUserLoggedIn } = useAuthStatus();
  const { isCreating, successWorldName, successWorldId, createWorld } = useWorldCreation();
  const { navigateToWorld } = useSuccessNavigation({ 
    showSuccessModal, 
    successWorldId 
  });

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

    const result = await createWorld({
      name: worldName,
      description: description,
      system: system,
      isDM: isDM,
      mapImageUrl: defaultMapImages[mapIndex]
    });

    if (result.success) {
      setShowSuccessModal(true);
    }
  };

  const handleSuccessNavigate = () => {
    navigateToWorld();
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
          <MapCanvas 
            onPress={() => {
              setImageImported(false);
              setMapIndex(Math.floor(Math.random() * defaultMapImages.length));
            }}
            imageImported={imageImported}
            imageUrl={defaultMapImages[mapIndex]}
          />

          {/* Import image button */}
          <PrimaryButton 
            style={{ margin: Spacing.md }} 
            textStyle={{}}
            onPress={() => setImageImported(true)}
          >
            Import Image
          </PrimaryButton>

          {/* Future drawing tools placeholder */}
        </View>
      )}

      {/* Modals */}
      <CreateWorldModals
        showSignInModal={showSignInModal}
        setShowSignInModal={setShowSignInModal}
        showValidationModal={showValidationModal}
        setShowValidationModal={setShowValidationModal}
        showSuccessModal={showSuccessModal}
        setShowSuccessModal={setShowSuccessModal}
        successWorldName={successWorldName}
        onSuccessNavigate={handleSuccessNavigate}
      />
    </ThemedView>
  );
}
