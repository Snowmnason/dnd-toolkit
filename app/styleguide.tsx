import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import AuthButton from '../components/auth_components/AuthButton';
import AuthError from '../components/auth_components/AuthError';
import AuthInput from '../components/auth_components/AuthInput';
import AuthSuccess from '../components/auth_components/AuthSuccess';
import CredentialConfirmModal from '../components/modals/CredentialConfirmModal';
import CustomModal from '../components/modals/CustomModal';
import UpdateUsernameModal from '../components/modals/UpdateUsernameModal';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import CustomLoad from '../components/ui/CustomLoad';
import Dropdown from '../components/ui/Dropdown';
import IconButton from '../components/ui/IconButton';
import PrimaryButton from '../components/ui/PrimaryButton';
import TextInput from '../components/ui/TextInput';
import { CoreColors } from '../constants/corecolors';
import { ComponentStyles, Spacing } from '../constants/theme';

export default function StyleGuidePage() {
  const [showModal, setShowModal] = useState(false);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [dropdownValue, setDropdownValue] = useState('option1');
  const [textInputValue, setTextInputValue] = useState('');
  const [authInputValue, setAuthInputValue] = useState('');

  const dropdownOptions = ['Option 1', 'Option 2', 'Option 3'];
  
  // Grid styles for side-by-side layout with wrap
  const gridContainerStyle = {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: Spacing.lg
  };
  const gridItemStyle = {

    flexGrow: 1,
    flexShrink: 1
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: Spacing.xl * 3
        }}
      >
        {/* Header */}
        <View style={{ marginBottom: Spacing.xl }}>
          <ThemedText type="title" style={{ 
            textAlign: 'center',
            color: CoreColors.textPrimary,
            fontSize: 32,
            fontWeight: '700',
            marginBottom: Spacing.sm
          }}>
            🎨 Style Guide
          </ThemedText>
          <ThemedText style={{ 
            textAlign: 'center',
            color: CoreColors.textPrimary,
            fontSize: 16
          }}>
            Component Showcase & Theme Reference
          </ThemedText>
        </View>

        {/* Grid container: side-by-side with wrap */}
        <View style={gridContainerStyle}>
          {/* Color Palette - Card */}
          <View style={[gridItemStyle, ComponentStyles.card.default]}>
            <ThemedText type="subtitle" style={{ 
              marginBottom: Spacing.md,
              color: CoreColors.textOnLight,
              fontSize: 24,
              fontWeight: '600'
            }}>
              Color Palette
            </ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg }}>
              {/* Primary Colors */}
              <View style={{ }}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm, color: CoreColors.textOnLight }}>Primary Colors</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={CoreColors.primary} label="Primary" />
                  <ColorSwatch color={CoreColors.primaryLight} label="Primary Light" />
                  <ColorSwatch color={CoreColors.primaryDark} label="Primary Dark" />
                </View>
              </View>

              {/* Secondary Colors */}
              <View style={{ }}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm, color: CoreColors.textOnLight }}>Secondary Colors</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={CoreColors.secondary} label="Secondary" />
                  <ColorSwatch color={CoreColors.secondaryLight} label="Secondary Light" />
                  <ColorSwatch color={CoreColors.secondaryDark} label="Secondary Dark" />
                </View>
              </View>

              {/* Background Colors */}
              <View style={{ }}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm, color: CoreColors.textOnLight }}>Background Colors</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={CoreColors.backgroundDark} label="BG Dark" />
                  <ColorSwatch color={CoreColors.backgroundLight} label="BG Light" />
                  <ColorSwatch color={CoreColors.backgroundAccent} label="BG Accent" />
                </View>
              </View>

              {/* Text Colors */}
              <View style={{ }}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm, color: CoreColors.textOnLight }}>Text Colors</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={CoreColors.textPrimary} label="Text Primary" />
                  <ColorSwatch color={CoreColors.textSecondary} label="Text Secondary" />
                  <ColorSwatch color={CoreColors.textOnLight} label="Text On Light" />
                </View>
              </View>

              {/* Utility Colors - full width */}
              <View style={{  }}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm, color: CoreColors.textOnLight }}>Utility Colors</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <ColorSwatch color={CoreColors.destructive} label="Destructive" />
                  <ColorSwatch color={CoreColors.error} label="Error" />
                  <ColorSwatch color={CoreColors.cancel} label="Cancel" />
                </View>
              </View>
            </View>
          </View>

          {/* Color Palette - Plain */}
          <View style={[gridItemStyle]}> 
            <ThemedText type="subtitle" style={{ 
              marginBottom: Spacing.md,
              color: CoreColors.textPrimary,
              fontSize: 24,
              fontWeight: '600'
            }}>
              Color Palette
            </ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg }}>
              {/* Primary Colors */}
              <View style={{ }}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm, color: CoreColors.textPrimary }}>Primary Colors</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={CoreColors.primary} label="Primary" textColor={CoreColors.textPrimary} />
                  <ColorSwatch color={CoreColors.primaryLight} label="Primary Light" textColor={CoreColors.textPrimary} />
                  <ColorSwatch color={CoreColors.primaryDark} label="Primary Dark" textColor={CoreColors.textPrimary} />
                </View>
              </View>

              {/* Secondary Colors */}
              <View style={{ }}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm, color: CoreColors.textPrimary }}>Secondary Colors</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={CoreColors.secondary} label="Secondary" textColor={CoreColors.textPrimary} />
                  <ColorSwatch color={CoreColors.secondaryLight} label="Secondary Light" textColor={CoreColors.textPrimary} />
                  <ColorSwatch color={CoreColors.secondaryDark} label="Secondary Dark" textColor={CoreColors.textPrimary} />
                </View>
              </View>

              {/* Background Colors */}
              <View style={{  }}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm, color: CoreColors.textPrimary }}>Background Colors</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={CoreColors.backgroundDark} label="BG Dark" textColor={CoreColors.textPrimary} />
                  <ColorSwatch color={CoreColors.backgroundLight} label="BG Light" textColor={CoreColors.textPrimary} />
                  <ColorSwatch color={CoreColors.backgroundAccent} label="BG Accent" textColor={CoreColors.textPrimary} />
                </View>
              </View>

              {/* Text Colors */}
              <View style={{  }}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm, color: CoreColors.textPrimary }}>Text Colors</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={CoreColors.textPrimary} label="Text Primary" textColor={CoreColors.textPrimary} />
                  <ColorSwatch color={CoreColors.textSecondary} label="Text Secondary" textColor={CoreColors.textPrimary} />
                  <ColorSwatch color={CoreColors.textOnLight} label="Text On Light" textColor={CoreColors.textPrimary} />
                </View>
              </View>

              {/* Utility Colors - full width */}
              <View style={{  }}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm, color: CoreColors.textPrimary }}>Utility Colors</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <ColorSwatch color={CoreColors.destructive} label="Destructive" textColor={CoreColors.textPrimary} />
                  <ColorSwatch color={CoreColors.error} label="Error" textColor={CoreColors.textPrimary} />
                  <ColorSwatch color={CoreColors.cancel} label="Cancel" textColor={CoreColors.textPrimary} />
                </View>
              </View>
            </View>
          </View>

          {/* Typography - Card */}
          <View style={[gridItemStyle, ComponentStyles.card.default]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textOnLight, fontSize: 24, fontWeight: '600' }}>Typography</ThemedText>
            <ThemedText type="title" style={{ color: CoreColors.textOnLight, marginBottom: Spacing.sm }}>Title Text - Large Headers</ThemedText>
            <ThemedText type="subtitle" style={{ color: CoreColors.textOnLight, marginBottom: Spacing.sm }}>Subtitle Text - Section Headers</ThemedText>
            <ThemedText type="defaultSemiBold" style={{ color: CoreColors.textOnLight, marginBottom: Spacing.sm }}>Default Semi-Bold - Emphasis</ThemedText>
            <ThemedText type="default" style={{ color: CoreColors.textOnLight, marginBottom: Spacing.sm }}>Default Text - Body Content</ThemedText>
            <ThemedText type="link" style={{ marginBottom: Spacing.sm }}>Link Text - Interactive Links</ThemedText>
          </View>

          {/* Typography - Plain */}
          <View style={[gridItemStyle]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textPrimary, fontSize: 24, fontWeight: '600' }}>Typography</ThemedText>
            <ThemedText type="title" style={{ color: CoreColors.textPrimary, marginBottom: Spacing.sm }}>Title Text - Large Headers</ThemedText>
            <ThemedText type="subtitle" style={{ color: CoreColors.textPrimary, marginBottom: Spacing.sm }}>Subtitle Text - Section Headers</ThemedText>
            <ThemedText type="defaultSemiBold" style={{ color: CoreColors.textPrimary, marginBottom: Spacing.sm }}>Default Semi-Bold - Emphasis</ThemedText>
            <ThemedText type="default" style={{ color: CoreColors.textPrimary, marginBottom: Spacing.sm }}>Default Text - Body Content</ThemedText>
            <ThemedText type="link" style={{ color: CoreColors.textPrimary, marginBottom: Spacing.sm }}>Link Text - Interactive Links</ThemedText>
          </View>

          {/* Buttons - Card */}
          <View style={[gridItemStyle, ComponentStyles.card.default]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textOnLight, fontSize: 24, fontWeight: '600' }}>Buttons</ThemedText>
            <View style={{ gap: Spacing.md }}>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Primary Buttons</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <PrimaryButton style={{ backgroundColor: CoreColors.primary, borderColor: CoreColors.primaryDark }} textStyle={{ color: CoreColors.textPrimary }} onPress={() => {}}>Primary Button</PrimaryButton>
                  <PrimaryButton style={{ backgroundColor: CoreColors.primary, borderColor: CoreColors.primaryDark, opacity: 0.5 }} textStyle={{ color: CoreColors.textPrimary }} onPress={() => {}} disabled>Disabled</PrimaryButton>
                </View>
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Secondary Buttons</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <PrimaryButton style={{ backgroundColor: CoreColors.secondaryButtonBackground, borderColor: CoreColors.secondaryButtonBorder, borderWidth: 1 }} textStyle={{ color: CoreColors.textOnLight }} onPress={() => {}}>Secondary Button</PrimaryButton>
                </View>
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Destructive Buttons</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <PrimaryButton style={{ backgroundColor: CoreColors.destructive, borderColor: CoreColors.destructiveBoarder }} textStyle={{ color: CoreColors.destructiveText }} onPress={() => {}}>Delete</PrimaryButton>
                  <PrimaryButton style={{ backgroundColor: CoreColors.destructiveDisabled, borderColor: CoreColors.destructiveDisabled, opacity: 0.6 }} textStyle={{ color: CoreColors.destructiveText }} onPress={() => {}} disabled>Disabled</PrimaryButton>
                </View>
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Auth Buttons</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <AuthButton title="Sign In" onPress={() => {}} />
                  <AuthButton title="Loading..." onPress={() => {}} loading />
                  <AuthButton title="Disabled" onPress={() => {}} disabled />
                </View>
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Icon Buttons</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <IconButton icon="settings" onPress={() => {}} />
                  <IconButton icon="trash" onPress={() => {}} />
                  <IconButton icon="add" onPress={() => {}} />
                </View>
              </View>
            </View>
          </View>

          {/* Buttons - Plain */}
          <View style={[gridItemStyle]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textPrimary, fontSize: 24, fontWeight: '600' }}>Buttons</ThemedText>
            <View style={{ gap: Spacing.md }}>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Primary Buttons</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <PrimaryButton style={{ backgroundColor: CoreColors.primary, borderColor: CoreColors.primaryDark }} textStyle={{ color: CoreColors.textPrimary }} onPress={() => {}}>Primary Button</PrimaryButton>
                  <PrimaryButton style={{ backgroundColor: CoreColors.primary, borderColor: CoreColors.primaryDark, opacity: 0.5 }} textStyle={{ color: CoreColors.textPrimary }} onPress={() => {}} disabled>Disabled</PrimaryButton>
                </View>
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Secondary Buttons</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <PrimaryButton style={{ backgroundColor: CoreColors.secondaryButtonBackground, borderColor: CoreColors.secondaryButtonBorder, borderWidth: 1 }} textStyle={{ color: CoreColors.textOnLight }} onPress={() => {}}>Secondary Button</PrimaryButton>
                </View>
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Destructive Buttons</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <PrimaryButton style={{ backgroundColor: CoreColors.destructive, borderColor: CoreColors.destructiveBoarder }} textStyle={{ color: CoreColors.destructiveText }} onPress={() => {}}>Delete</PrimaryButton>
                  <PrimaryButton style={{ backgroundColor: CoreColors.destructiveDisabled, borderColor: CoreColors.destructiveDisabled, opacity: 0.6 }} textStyle={{ color: CoreColors.destructiveText }} onPress={() => {}} disabled>Disabled</PrimaryButton>
                </View>
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Auth Buttons</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <AuthButton title="Sign In" onPress={() => {}} />
                  <AuthButton title="Loading..." onPress={() => {}} loading />
                  <AuthButton title="Disabled" onPress={() => {}} disabled />
                </View>
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Icon Buttons</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <IconButton icon="settings" onPress={() => {}} />
                  <IconButton icon="trash" onPress={() => {}} />
                  <IconButton icon="add" onPress={() => {}} />
                </View>
              </View>
            </View>
          </View>

          {/* Input Fields - Card */}
          <View style={[gridItemStyle, ComponentStyles.card.default]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textOnLight, fontSize: 24, fontWeight: '600' }}>Input Fields</ThemedText>
            <View style={{ gap: Spacing.md }}>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Text Input</ThemedText>
                <TextInput placeholder="Enter text here..." value={textInputValue} onChangeText={setTextInputValue} />
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Auth Input</ThemedText>
                <AuthInput placeholder="Email or password..." value={authInputValue} onChangeText={setAuthInputValue} />
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Dropdown</ThemedText>
                <Dropdown options={dropdownOptions} value={dropdownValue} onChange={(value: string | null) => value && setDropdownValue(value)} placeholder="Select an option" />
              </View>
            </View>
          </View>

          {/* Input Fields - Plain */}
          <View style={[gridItemStyle]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textPrimary, fontSize: 24, fontWeight: '600' }}>Input Fields</ThemedText>
            <View style={{ gap: Spacing.md }}>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Text Input</ThemedText>
                <TextInput placeholder="Enter text here..." value={textInputValue} onChangeText={setTextInputValue} />
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Auth Input</ThemedText>
                <AuthInput placeholder="Email or password..." value={authInputValue} onChangeText={setAuthInputValue} />
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Dropdown</ThemedText>
                <Dropdown options={dropdownOptions} value={dropdownValue} onChange={(value: string | null) => value && setDropdownValue(value)} placeholder="Select an option" />
              </View>
            </View>
          </View>

          {/* Feedback - Card */}
          <View style={[gridItemStyle, ComponentStyles.card.default]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textOnLight, fontSize: 24, fontWeight: '600' }}>Feedback Components</ThemedText>
            <View style={{ gap: Spacing.md }}>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Loading Spinner</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
                  <CustomLoad size="small" color={CoreColors.primary} />
                  <CustomLoad size="large" color={CoreColors.secondary} />
                </View>
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Success Message</ThemedText>
                <AuthSuccess message="Operation completed successfully!" />
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textOnLight }}>Error Message</ThemedText>
                <AuthError error="Something went wrong. Please try again." />
              </View>
            </View>
          </View>

          {/* Feedback - Plain */}
          <View style={[gridItemStyle]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textPrimary, fontSize: 24, fontWeight: '600' }}>Feedback Components</ThemedText>
            <View style={{ gap: Spacing.md }}>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Loading Spinner</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
                  <CustomLoad size="small" color={CoreColors.primary} />
                  <CustomLoad size="large" color={CoreColors.secondary} />
                </View>
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Success Message</ThemedText>
                <AuthSuccess message="Operation completed successfully!" />
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.xs, color: CoreColors.textPrimary }}>Error Message</ThemedText>
                <AuthError error="Something went wrong. Please try again." />
              </View>
            </View>
          </View>

          {/* Modals - Card */}
          <View style={[gridItemStyle, ComponentStyles.card.default]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textOnLight, fontSize: 24, fontWeight: '600' }}>Modals</ThemedText>
            <View style={{ gap: Spacing.sm }}>
              <PrimaryButton style={{ backgroundColor: CoreColors.primary, borderColor: CoreColors.primaryDark }} textStyle={{ color: CoreColors.textPrimary }} onPress={() => setShowModal(true)}>Open Custom Modal</PrimaryButton>
              <PrimaryButton style={{ backgroundColor: CoreColors.primary, borderColor: CoreColors.primaryDark }} textStyle={{ color: CoreColors.textPrimary }} onPress={() => setShowCredentialModal(true)}>Open Credential Modal</PrimaryButton>
              <PrimaryButton style={{ backgroundColor: CoreColors.primary, borderColor: CoreColors.primaryDark }} textStyle={{ color: CoreColors.textPrimary }} onPress={() => setShowUsernameModal(true)}>Open Username Modal</PrimaryButton>
            </View>
          </View>

          {/* Modals - Plain */}
          <View style={[gridItemStyle]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textPrimary, fontSize: 24, fontWeight: '600' }}>Modals</ThemedText>
            <View style={{ gap: Spacing.sm }}>
              <PrimaryButton style={{ backgroundColor: CoreColors.primary, borderColor: CoreColors.primaryDark }} textStyle={{ color: CoreColors.textPrimary }} onPress={() => setShowModal(true)}>Open Custom Modal</PrimaryButton>
              <PrimaryButton style={{ backgroundColor: CoreColors.primary, borderColor: CoreColors.primaryDark }} textStyle={{ color: CoreColors.textPrimary }} onPress={() => setShowCredentialModal(true)}>Open Credential Modal</PrimaryButton>
              <PrimaryButton style={{ backgroundColor: CoreColors.primary, borderColor: CoreColors.primaryDark }} textStyle={{ color: CoreColors.textPrimary }} onPress={() => setShowUsernameModal(true)}>Open Username Modal</PrimaryButton>
            </View>
          </View>

          {/* Icons - Card */}
          <View style={[gridItemStyle, ComponentStyles.card.default]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textOnLight, fontSize: 24, fontWeight: '600' }}>Icons</ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }}>
              <IconDisplay name="home" />
              <IconDisplay name="settings" />
              <IconDisplay name="person" />
              <IconDisplay name="trash" />
              <IconDisplay name="add" />
              <IconDisplay name="close" />
              <IconDisplay name="checkmark" />
              <IconDisplay name="arrow-forward" />
            </View>
          </View>

          {/* Icons - Plain */}
          <View style={[gridItemStyle]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textPrimary, fontSize: 24, fontWeight: '600' }}>Icons</ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }}>
              <IconDisplay name="home" textColor={CoreColors.textPrimary} />
              <IconDisplay name="settings" textColor={CoreColors.textPrimary} />
              <IconDisplay name="person" textColor={CoreColors.textPrimary} />
              <IconDisplay name="trash" textColor={CoreColors.textPrimary} />
              <IconDisplay name="add" textColor={CoreColors.textPrimary} />
              <IconDisplay name="close" textColor={CoreColors.textPrimary} />
              <IconDisplay name="checkmark" textColor={CoreColors.textPrimary} />
              <IconDisplay name="arrow-forward" textColor={CoreColors.textPrimary} />
            </View>
          </View>

          {/* Spacing Reference - Card */}
          <View style={[gridItemStyle, ComponentStyles.card.default]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textOnLight, fontSize: 24, fontWeight: '600' }}>Spacing Reference</ThemedText>
            <View style={{ gap: Spacing.sm }}>
              <SpacingExample size={Spacing.xs} label="XS (4px)" />
              <SpacingExample size={Spacing.sm} label="SM (8px)" />
              <SpacingExample size={Spacing.md} label="MD (16px)" />
              <SpacingExample size={Spacing.lg} label="LG (24px)" />
              <SpacingExample size={Spacing.xl} label="XL (32px)" />
            </View>
          </View>

          {/* Spacing Reference - Plain */}
          <View style={[gridItemStyle]}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.md, color: CoreColors.textPrimary, fontSize: 24, fontWeight: '600' }}>Spacing Reference</ThemedText>
            <View style={{ gap: Spacing.sm }}>
              <SpacingExample size={Spacing.xs} label="XS (4px)" textColor={CoreColors.textPrimary} />
              <SpacingExample size={Spacing.sm} label="SM (8px)" textColor={CoreColors.textPrimary} />
              <SpacingExample size={Spacing.md} label="MD (16px)" textColor={CoreColors.textPrimary} />
              <SpacingExample size={Spacing.lg} label="LG (24px)" textColor={CoreColors.textPrimary} />
              <SpacingExample size={Spacing.xl} label="XL (32px)" textColor={CoreColors.textPrimary} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <CustomModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title="Sample Modal"
        message="This is an example of our custom modal component with buttons."
        buttons={[
          { text: 'Cancel', onPress: () => setShowModal(false), style: 'cancel' },
          { text: 'Confirm', onPress: () => setShowModal(false), style: 'primary' }
        ]}
      />

      <CredentialConfirmModal
        visible={showCredentialModal}
        title="Credential Confirmation"
        message="Enter your password to confirm this action."
        confirmLabel="Confirm"
        onCancel={() => setShowCredentialModal(false)}
        onConfirm={async () => {
          setShowCredentialModal(false);
        }}
      />

      <UpdateUsernameModal
        visible={showUsernameModal}
        currentUsername="current_user"
        onCancel={() => setShowUsernameModal(false)}
        onConfirm={async () => {
          setShowUsernameModal(false);
        }}
      />
    </ThemedView>
  );
}

// Helper Components
function ColorSwatch({ color, label, textColor }: { color: string; label: string; textColor?: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 80 }}>
      <View
        style={{
          width: 60,
          height: 60,
          backgroundColor: color,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: CoreColors.borderPrimary,
          marginBottom: Spacing.xs
        }}
      />
      <ThemedText style={{ fontSize: 10, textAlign: 'center', color: textColor ?? CoreColors.textSecondary }}>
        {label}
      </ThemedText>
      <ThemedText style={{ fontSize: 9, textAlign: 'center', color: textColor ?? CoreColors.textSecondary, opacity: 0.7 }}>
        {color}
      </ThemedText>
    </View>
  );
}

function IconDisplay({ name, textColor }: { name: any; textColor?: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 60 }}>
      <View
        style={{
          width: 50,
          height: 50,
          backgroundColor: CoreColors.secondaryButtonBackground,
          borderRadius: 8,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: Spacing.xs
        }}
      >
        <Ionicons name={name} size={24} color={CoreColors.textOnLight} />
      </View>
      <ThemedText style={{ fontSize: 10, textAlign: 'center', color: textColor ?? CoreColors.textSecondary }}>
        {name}
      </ThemedText>
    </View>
  );
}

function SpacingExample({ size, label, textColor }: { size: number; label: string; textColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
      <View
        style={{
          width: size,
          height: 20,
          backgroundColor: CoreColors.secondary,
          borderRadius: 4
        }}
      />
      <ThemedText style={{ fontSize: 14, color: textColor ?? CoreColors.textOnLight }}>
        {label}
      </ThemedText>
    </View>
  );
}
