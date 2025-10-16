
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';
import { Button, Input, ScrollView, Select, Text, TextArea, View } from 'tamagui';
import CreateWorldModals from '../../components/create-world/CreateWorldModals';
import MapCanvas from '../../components/create-world/MapCanvas';
// import { ComponentStyles } from '../../constants/theme'; // deprecated
import { Spacing } from '../../constants/theme';
import { useAuthStatus } from '../../hooks/use-auth-status';
import { useSuccessNavigation } from '../../hooks/use-success-navigation';
import { useWorldCreation } from '../../hooks/use-world-creation';
import { createWorldNameChangeHandler, isValidWorldNameForSubmission, type WorldNameValidationResult } from '../../lib/auth/validation';

const tabletopSystems = [
  { label: 'D&D 5e', value: 'dnd5e' },
  { label: 'Pathfinder 2e', value: 'pf2e' },
  { label: 'Call of Cthulhu', value: 'coc' },
]
const defaultMapImages = ["https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_MedRes.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgJm47wbufqY9yqRw_OLFJBtLEYYNGlCMMHWRozByIB4-SvH-6lwXPEI7L4LXhA1la-Ek0w7L_TU1wBkX4P7Z4fKmVQ2XAHuAmiF-4HYOGKWAZofbqc0e3pNca2dvU4HAWDuh8bg4y869M/s1600/Vlaroa1.jpg",
  "https://talaraska.com/wp-content/uploads/2024/01/text-1-hw-terrain-4275x2600-1.jpg",
  "https://images.squarespace-cdn.com/content/v1/5dadaf88e03a4e6bb69307dd/904f0cc0-7846-4576-ac91-176528727e4b/Vhaledhon+No+Text+Map+Blog.jpg",
 ];

export default function CreateWorldScreen() {
  // Form state
  const [worldName, setWorldName] = useState('');
  const [worldNameValidation, setWorldNameValidation] = useState<WorldNameValidationResult | null>(null);
  const [system, setSystem] = useState(tabletopSystems[0].value);
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
    if (!isValidWorldNameForSubmission(worldName)) {
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
      //system: system,
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
    <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
      {/* Left Panel: Form */}
      <View style={{ flex: 1, padding: Spacing.md }}>
        <ScrollView >
          <View style={{ paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: 12, marginBottom: Spacing.md, borderWidth: 2 }}>
            <Text style={{
              textAlign: 'center',
              fontWeight: '700',
              //color: CoreColors.textPrimary,
              //...createTextShadow(CoreColors.backgroundDark, { width: 2, height: 2 }, 4)
            }}>
              Create New World
            </Text>
          </View>

          {/* World Name */}
          <Text style={{
            fontWeight: '600',
            fontSize: 16,
            //...createTextShadow(CoreColors.secondary, { width: 1, height: 1 }, 2),
            marginBottom: Spacing.xs
          }}>
            Name of World
          </Text>
          <Input
            placeholder="World Name"
            value={worldName}
            onChangeText={createWorldNameChangeHandler(setWorldName, setWorldNameValidation)}
            style={{ marginBottom: Spacing.md }}
          />
          
          {/* Validation errors */}
          {worldNameValidation && !worldNameValidation.isValid && (
            <View style={{ marginBottom: Spacing.md }}>
              {worldNameValidation.errors.map((error, index) => (
                <Text key={index} style={{
                  color: '#FF6B6B',
                  fontSize: 14,
                  marginBottom: Spacing.xs
                }}>
                  ⚠️ {error}
                </Text>
              ))}
            </View>
          )}

          {/* Tabletop System */}
          <Text style={{
            fontWeight: '600',
            fontSize: 16,
            //...createTextShadow(CoreColors.secondary, { width: 1, height: 1 }, 2),
            marginBottom: Spacing.xs
          }}>
            Tabletop System
          </Text>
          <Select
            value={system}
            onValueChange={(value) => {
              if (value !== null) setSystem(value);
            }}
          >
            <Select.Trigger>
              <Select.Value placeholder="Select a tabletop system">
                {tabletopSystems.find((item) => item.value === system)?.label ?? ''}
              </Select.Value>
            </Select.Trigger>

            <Select.Content>
              <Select.ScrollUpButton />
              <Select.Viewport>
                <Select.Group>
                  {tabletopSystems.map((item, idx) => (
                    <Select.Item key={item.value} value={item.value} index={idx}>
                      <Select.ItemText>{item.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Viewport>
              <Select.ScrollDownButton />
            </Select.Content>
          </Select>

          {/* Description */}
          <Text style={{
            fontWeight: '600',
            fontSize: 16,
            //...createTextShadow(CoreColors.secondary, { width: 1, height: 1 }, 2),
            marginBottom: Spacing.xs
          }}>
            Description
          </Text>
          <TextArea
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
            <Button 
            //variant="secondary" style={{ marginBottom: Spacing.md }} 
            onPress={() => {}}>
              Import Image
            </Button>
          )}

          {/* Action Buttons */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: Spacing.md,
          }}>
            <Button 
              //variant="cancel"
              onPress={() => router.replace('/select/world-selection')}
            >
              Cancel
            </Button>
            <Button
              //variant="primary"
              disabled={!isValidWorldNameForSubmission(worldName) || isCreating}
              onPress={handleCreateWorld}
            >
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </View>
        </ScrollView>
      </View>

      {/* Right Panel (desktop only) */}
      {isDesktop && (
        <View style={{
          flex: 4,
          borderLeftWidth: 1,
          //borderLeftColor: CoreColors.borderPrimary
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
          <Button 
          //variant="secondary" style={{ margin: Spacing.md }} 
          onPress={() => setImageImported(true)}>
            Import Image
          </Button>

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
    </View>
  );
}
