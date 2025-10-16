import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Button, Card, Heading, Input, Paragraph, ScrollView, Select, Text, View, XStack, YStack } from 'tamagui';
import AuthButton from '../components/auth_components/AuthButton';
import AuthError from '../components/auth_components/AuthError';
import AuthInput from '../components/auth_components/AuthInput';
import AuthSuccess from '../components/auth_components/AuthSuccess';
import CredentialConfirmModal from '../components/modals/CredentialConfirmModal';
import CustomModal from '../components/modals/CustomModal';
import UpdateUsernameModal from '../components/modals/UpdateUsernameModal';
// import AppButton from '../components/ui/AppButton'; // deprecated
import CustomLoad from '../components/ui/CustomLoad';
// import Dropdown from '../components/ui/Dropdown'; // deprecated
import IconButton from '../components/ui/IconButton';
// import TextInput from '../components/ui/TextInput'; // deprecated
// import { CoreColors } from '../constants/corecolors'; // deprecated

// Local spacing scale (px) while we transition to Tamagui tokens in this page
const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export default function StyleGuidePage() {
  const [showModal, setShowModal] = useState(false);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [dropdownValue, setDropdownValue] = useState('option1');
  const [textInputValue, setTextInputValue] = useState('');
  const [authInputValue, setAuthInputValue] = useState('');

  const dropdownOptions = ['Option 1', 'Option 2', 'Option 3'];

  const gridContainerStyle = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: S.lg };
  const gridItemStyle = { flexGrow: 1, flexShrink: 1 };

  return (
    <YStack style={{ flex: 1 }}>
      <ScrollView>
        <YStack style={{ padding: S.lg, paddingBottom: S.xl * 3 }}>
        {/* Header */}
        <YStack style={{ marginBottom: S.xl }}>
          <Heading size="$10" style={{ textAlign: 'center', marginBottom: S.sm }}>
            🎨 Style Guide
          </Heading>
          <Paragraph size="$5" style={{ textAlign: 'center' }}>
            Component Showcase & Theme Reference
          </Paragraph>
        </YStack>

        {/* Grid container: side-by-side with wrap */}
        <XStack style={gridContainerStyle}>
          {/* Color Palette - Card */}
          <Card style={[gridItemStyle, { padding: S.md, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' }]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Color Palette</Heading>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.lg }}>
              {/* Primary Colors */}
              <View style={{ }}>
                <Text style={{ marginBottom: S.sm, fontWeight: '600' }}>Primary Colors</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={"#8B4513"} label="Primary" />
                  <ColorSwatch color={"#A0522D"} label="Primary Light" />
                  <ColorSwatch color={"#5D3315"} label="Primary Dark" />
                </View>
              </View>

              {/* Secondary Colors */}
              <View style={{ }}>
                <Text style={{ marginBottom: S.sm, fontWeight: '600' }}>Secondary Colors</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={"#D4AF37"} label="Secondary" />
                  <ColorSwatch color={"#E6C84E"} label="Secondary Light" />
                  <ColorSwatch color={"#B6942E"} label="Secondary Dark" />
                </View>
              </View>

              {/* Background Colors */}
              <View style={{ }}>
                <Text style={{ marginBottom: S.sm, fontWeight: '600' }}>Background Colors</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={"#2f353d"} label="BG Dark" />
                  <ColorSwatch color={"#F5E6D3"} label="BG Light" />
                  <ColorSwatch color={"#3D444C"} label="BG Accent" />
                </View>
              </View>

              {/* Text Colors */}
              <View style={{ }}>
                <Text style={{ marginBottom: S.sm, fontWeight: '600' }}>Text Colors</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={"#F5E6D3"} label="Text Primary" />
                  <ColorSwatch color={"#C8B9A1"} label="Text Secondary" />
                  <ColorSwatch color={"#2f353d"} label="Text On Light" />
                </View>
              </View>

              {/* Utility Colors - full width */}
              <View style={{  }}>
                <Text style={{ marginBottom: S.sm, fontWeight: '600' }}>Utility Colors</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <ColorSwatch color={"#DC2626"} label="Destructive" />
                  <ColorSwatch color={"#EF4444"} label="Error" />
                  <ColorSwatch color={"#6B7280"} label="Cancel" />
                </View>
              </View>
            </View>
          </Card>

          {/* Color Palette - Plain */}
          <YStack style={[gridItemStyle]}> 
            <Heading size="$8" style={{ marginBottom: S.md }}>Color Palette</Heading>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.lg }}>
              {/* Primary Colors */}
              <View style={{ }}>
                <Text style={{ marginBottom: S.sm, fontWeight: '600' }}>Primary Colors</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={"#8B4513"} label="Primary" textColor={"#F5E6D3"} />
                  <ColorSwatch color={"#A0522D"} label="Primary Light" textColor={"#2f353d"} />
                  <ColorSwatch color={"#5D3315"} label="Primary Dark" textColor={"#F5E6D3"} />
              </View>
              </View>

              {/* Secondary Colors */}
              <View style={{ }}>
                <Text style={{ marginBottom: S.sm, fontWeight: '600' }}>Secondary Colors</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={"#D4AF37"} label="Secondary" textColor={"#2f353d"} />
                  <ColorSwatch color={"#E6C84E"} label="Secondary Light" textColor={"#2f353d"} />
                  <ColorSwatch color={"#B6942E"} label="Secondary Dark" textColor={"#F5E6D3"} />
                </View>
              </View>

              {/* Background Colors */}
              <View style={{  }}>
                <Text style={{ marginBottom: S.sm, fontWeight: '600' }}>Background Colors</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={"#2f353d"} label="BG Dark" textColor={"#F5E6D3"} />
                  <ColorSwatch color={"#F5E6D3"} label="BG Light" textColor={"#2f353d"} />
                  <ColorSwatch color={"#3D444C"} label="BG Accent" textColor={"#F5E6D3"} />
                </View>
              </View>

              {/* Text Colors */}
              <View style={{  }}>
                <Text style={{ marginBottom: S.sm, fontWeight: '600' }}>Text Colors</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
                  <ColorSwatch color={"#F5E6D3"} label="Text Primary" textColor={"#2f353d"} />
                  <ColorSwatch color={"#C8B9A1"} label="Text Secondary" textColor={"#2f353d"} />
                  <ColorSwatch color={"#2f353d"} label="Text On Light" textColor={"#F5E6D3"} />
                </View>
              </View>

              {/* Utility Colors - full width */}
              <View style={{  }}>
                <Text style={{ marginBottom: S.sm, fontWeight: '600' }}>Utility Colors</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <ColorSwatch color={"#DC2626"} label="Destructive" textColor={"#F5E6D3"} />
                  <ColorSwatch color={"#EF4444"} label="Error" textColor={"#F5E6D3"} />
                  <ColorSwatch color={"#6B7280"} label="Cancel" textColor={"#F5E6D3"} />
                </View>
              </View>
            </View>
          </YStack>

          {/* Typography - Card */}
          <Card style={[gridItemStyle, { padding: S.md, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' }]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Typography</Heading>
            <Heading size="$10" style={{ marginBottom: S.sm }}>Title Text - Large Headers</Heading>
            <Heading size="$8" style={{ marginBottom: S.sm }}>Subtitle Text - Section Headers</Heading>
            <Text style={{ fontWeight: '600', marginBottom: S.sm }}>Default Semi-Bold - Emphasis</Text>
            <Paragraph style={{ marginBottom: S.sm }}>Default Text - Body Content</Paragraph>
            <Text style={{ textDecorationLine: 'underline', marginBottom: S.sm }}>Link Text - Interactive Links</Text>
          </Card>

          {/* Typography - Plain */}
          <YStack style={[gridItemStyle]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Typography</Heading>
            <Heading size="$10" style={{ marginBottom: S.sm }}>Title Text - Large Headers</Heading>
            <Heading size="$8" style={{ marginBottom: S.sm }}>Subtitle Text - Section Headers</Heading>
            <Text style={{ fontWeight: '600', marginBottom: S.sm }}>Default Semi-Bold - Emphasis</Text>
            <Paragraph style={{ marginBottom: S.sm }}>Default Text - Body Content</Paragraph>
            <Text style={{ textDecorationLine: 'underline', marginBottom: S.sm }}>Link Text - Interactive Links</Text>
          </YStack>

          {/* Buttons - Card */}
          <Card style={[gridItemStyle, { padding: S.md, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' }]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Buttons</Heading>
            <View style={{ gap: S.md }}>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Primary Buttons</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <Button onPress={() => {}}>Primary Button</Button>
                  <Button disabled onPress={() => {}}>Disabled</Button>
                </View>
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Secondary Buttons</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <Button onPress={() => {}}>Secondary Button</Button>
                </View>
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Destructive Buttons</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <Button onPress={() => {}}>Delete</Button>
                  <Button disabled onPress={() => {}}>Disabled</Button>
                </View>
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Auth Buttons</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <AuthButton title="Sign In" onPress={() => {}} />
                  <AuthButton title="Loading..." onPress={() => {}} loading />
                  <AuthButton title="Disabled" onPress={() => {}} disabled />
                </View>
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Icon Buttons</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <IconButton icon="settings" onPress={() => {}} />
                  <IconButton icon="trash" onPress={() => {}} />
                  <IconButton icon="add" onPress={() => {}} />
                </View>
              </View>
            </View>
          </Card>

          {/* Buttons - Plain */}
          <YStack style={[gridItemStyle]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Buttons</Heading>
            <View style={{ gap: S.md }}>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Primary Buttons</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <Button onPress={() => {}}>Primary Button</Button>
                  <Button disabled onPress={() => {}}>Disabled</Button>
                </View>
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Secondary Buttons</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <Button onPress={() => {}}>Secondary Button</Button>
                </View>
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Destructive Buttons</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <Button onPress={() => {}}>Delete</Button>
                  <Button disabled onPress={() => {}}>Disabled</Button>
                </View>
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Auth Buttons</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <AuthButton title="Sign In" onPress={() => {}} />
                  <AuthButton title="Loading..." onPress={() => {}} loading />
                  <AuthButton title="Disabled" onPress={() => {}} disabled />
                </View>
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Icon Buttons</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <IconButton icon="settings" onPress={() => {}} />
                  <IconButton icon="trash" onPress={() => {}} />
                  <IconButton icon="add" onPress={() => {}} />
                </View>
              </View>
            </View>
          </YStack>

          {/* Input Fields - Card */}
          <Card style={[gridItemStyle, { padding: S.md, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' }]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Input Fields</Heading>
            <View style={{ gap: S.md }}>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Text Input</Text>
                <Input placeholder="Enter text here..." value={textInputValue} onChangeText={setTextInputValue} />
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Auth Input</Text>
                <AuthInput placeholder="Email or password..." value={authInputValue} onChangeText={setAuthInputValue} />
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Dropdown</Text>
                <Select value={dropdownValue} onValueChange={(v) => v && setDropdownValue(v)}>
                  <Select.Trigger>
                    <Select.Value placeholder="Select an option">
                      {dropdownOptions.find((o) => o.toLowerCase().replace(/\s+/g, '') === dropdownValue)?.toString() || ''}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.ScrollUpButton />
                    <Select.Viewport>
                      <Select.Group>
                        {dropdownOptions.map((opt, idx) => (
                          <Select.Item key={opt} value={opt.toLowerCase().replace(/\s+/g, '')} index={idx}>
                            <Select.ItemText>{opt}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                  </Select.Content>
                </Select>
              </View>
            </View>
          </Card>

          {/* Input Fields - Plain */}
          <YStack style={[gridItemStyle]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Input Fields</Heading>
            <View style={{ gap: S.md }}>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Text Input</Text>
                <Input placeholder="Enter text here..." value={textInputValue} onChangeText={setTextInputValue} />
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Auth Input</Text>
                <AuthInput placeholder="Email or password..." value={authInputValue} onChangeText={setAuthInputValue} />
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Dropdown</Text>
                <Select value={dropdownValue} onValueChange={(v) => v && setDropdownValue(v)}>
                  <Select.Trigger>
                    <Select.Value placeholder="Select an option">
                      {dropdownOptions.find((o) => o.toLowerCase().replace(/\s+/g, '') === dropdownValue)?.toString() || ''}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.ScrollUpButton />
                    <Select.Viewport>
                      <Select.Group>
                        {dropdownOptions.map((opt, idx) => (
                          <Select.Item key={opt} value={opt.toLowerCase().replace(/\s+/g, '')} index={idx}>
                            <Select.ItemText>{opt}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                  </Select.Content>
                </Select>
              </View>
            </View>
          </YStack>

          {/* Feedback - Card */}
          <Card style={[gridItemStyle, { padding: S.md, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' }]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Feedback Components</Heading>
            <View style={{ gap: S.md }}>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Loading Spinner</Text>
                <View style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }}>
                  <CustomLoad size="small" color={'#8B4513'} />
                  <CustomLoad size="large" color={'#D4AF37'} />
                </View>
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Success Message</Text>
                <AuthSuccess message="Operation completed successfully!" />
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Error Message</Text>
                <AuthError error="Something went wrong. Please try again." />
              </View>
            </View>
          </Card>

          {/* Feedback - Plain */}
          <YStack style={[gridItemStyle]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Feedback Components</Heading>
            <View style={{ gap: S.md }}>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Loading Spinner</Text>
                <View style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }}>
                  <CustomLoad size="small" color={'#8B4513'} />
                  <CustomLoad size="large" color={'#D4AF37'} />
                </View>
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Success Message</Text>
                <AuthSuccess message="Operation completed successfully!" />
              </View>
              <View>
                <Text style={{ marginBottom: S.xs, fontWeight: '600' }}>Error Message</Text>
                <AuthError error="Something went wrong. Please try again." />
              </View>
            </View>
          </YStack>

          {/* Modals - Card */}
          <Card style={[gridItemStyle, { padding: S.md, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' }]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Modals</Heading>
            <View style={{ gap: S.sm }}>
              <Button onPress={() => setShowModal(true)}>Open Custom Modal</Button>
              <Button onPress={() => setShowCredentialModal(true)}>Open Credential Modal</Button>
              <Button onPress={() => setShowUsernameModal(true)}>Open Username Modal</Button>
            </View>
          </Card>

          {/* Modals - Plain */}
          <YStack style={[gridItemStyle]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Modals</Heading>
            <View style={{ gap: S.sm }}>
              <Button onPress={() => setShowModal(true)}>Open Custom Modal</Button>
              <Button onPress={() => setShowCredentialModal(true)}>Open Credential Modal</Button>
              <Button onPress={() => setShowUsernameModal(true)}>Open Username Modal</Button>
            </View>
          </YStack>

          {/* Icons - Card */}
          <Card style={[gridItemStyle, { padding: S.md, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' }]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Icons</Heading>
            <View style={{ flexDirection: 'row', gap: S.md, flexWrap: 'wrap' }}>
              <IconDisplay name="home" />
              <IconDisplay name="settings" />
              <IconDisplay name="person" />
              <IconDisplay name="trash" />
              <IconDisplay name="add" />
              <IconDisplay name="close" />
              <IconDisplay name="checkmark" />
              <IconDisplay name="arrow-forward" />
            </View>
          </Card>

          {/* Icons - Plain */}
          <YStack style={[gridItemStyle]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Icons</Heading>
            <View style={{ flexDirection: 'row', gap: S.md, flexWrap: 'wrap' }}>
              <IconDisplay name="home" textColor={'#F5E6D3'} />
              <IconDisplay name="settings" textColor={'#F5E6D3'} />
              <IconDisplay name="person" textColor={'#F5E6D3'} />
              <IconDisplay name="trash" textColor={'#F5E6D3'} />
              <IconDisplay name="add" textColor={'#F5E6D3'} />
              <IconDisplay name="close" textColor={'#F5E6D3'} />
              <IconDisplay name="checkmark" textColor={'#F5E6D3'} />
              <IconDisplay name="arrow-forward" textColor={'#F5E6D3'} />
            </View>
          </YStack>

          {/* Spacing Reference - Card */}
          <Card style={[gridItemStyle, { padding: S.md, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' }]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Spacing Reference</Heading>
            <View style={{ gap: S.sm }}>
              <SpacingExample size={S.xs} label="XS (4px)" />
              <SpacingExample size={S.sm} label="SM (8px)" />
              <SpacingExample size={S.md} label="MD (16px)" />
              <SpacingExample size={S.lg} label="LG (24px)" />
              <SpacingExample size={S.xl} label="XL (32px)" />
            </View>
          </Card>

          {/* Spacing Reference - Plain */}
          <YStack style={[gridItemStyle]}>
            <Heading size="$8" style={{ marginBottom: S.md }}>Spacing Reference</Heading>
            <View style={{ gap: S.sm }}>
              <SpacingExample size={S.xs} label="XS (4px)" textColor={'#F5E6D3'} />
              <SpacingExample size={S.sm} label="SM (8px)" textColor={'#F5E6D3'} />
              <SpacingExample size={S.md} label="MD (16px)" textColor={'#F5E6D3'} />
              <SpacingExample size={S.lg} label="LG (24px)" textColor={'#F5E6D3'} />
              <SpacingExample size={S.xl} label="XL (32px)" textColor={'#F5E6D3'} />
            </View>
          </YStack>
        </XStack>
        </YStack>
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
    </YStack>
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
          borderColor: '#888',
          marginBottom: S.xs
        }}
      />
      <Text style={{ fontSize: 10, textAlign: 'center', color: textColor ?? '#C8B9A1' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 9, textAlign: 'center', color: textColor ?? '#C8B9A1', opacity: 0.7 }}>
        {color}
      </Text>
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
          backgroundColor: '#3D444C',
          borderRadius: 8,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: S.xs
        }}
      >
        <Ionicons name={name} size={24} color={'#F5E6D3'} />
      </View>
      <Text style={{ fontSize: 10, textAlign: 'center', color: textColor ?? '#C8B9A1' }}>
        {name}
      </Text>
    </View>
  );
}

function SpacingExample({ size, label, textColor }: { size: number; label: string; textColor?: string }) {
  return (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
      <View
        style={{
          width: size,
          height: 20,
          backgroundColor: '#D4AF37',
          borderRadius: 4
        }}
      />
      <Text style={{ fontSize: 14, color: textColor ?? '#F5E6D3' }}>
        {label}
      </Text>
    </View>
  );
}
