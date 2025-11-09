import { ThemeSelector } from '@/Screens/settings/ThemeSelector'
import {
  Accordion,
  AppModal,
  AppToast,
  AppTooltip,
  Body,
  Button,
  ButtonGroup,
  Caption,
  Card,
  CustomLoad,
  DescInput,
  Dropdown,
  DropdownGroup,
  Heading,
  IconButton,
  Link,
  NotificationContainer,
  ObjHeading,
  Paragraph,
  RadioButtonGroup,
  SnackBar,
  SubTitle,
  Surface,
  Switch,
  SwitchGroup,
  Tabs,
  TextInput,
  TextInputGroup,
  Title,
  ToggleGroup
} from '@/components/ui'
import { useNotifications } from '@/hooks/use-notifications'
import { $, useScale } from '@/theme'
import React, { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

export default function StyleMobile() {
  const S = useScale()
  const { showNotification } = useNotifications()
  
  // Simple display states
  const [primaryClicks, setPrimaryClicks] = useState(0)
  const [iconButtonClicks, setIconButtonClicks] = useState('')
  const [textInputValue, setTextInputValue] = useState('')
  const [descInputValue, setDescInputValue] = useState('')
  const [dropdownValue, setDropdownValue] = useState<string | null>(null)
  const [switchOn, setSwitchOn] = useState(false)
  const [tabValue, setTabValue] = useState('overview')
  const [colorTabValue, setColorTabValue] = useState('textPrimary')
  
  // Refs to access group components
  const buttonGroupRef = React.useRef<any>(null)
  const textInputGroupRef = React.useRef<any>(null)
  const dropdownGroupRef = React.useRef<any>(null)
  const switchGroupRef = React.useRef<any>(null)
  const switchGroupExclusiveRef = React.useRef<any>(null)
  const switchGroupMaxRef = React.useRef<any>(null)
  const radioGroupRef = React.useRef<any>(null)
  const toggleGroupRef = React.useRef<any>(null)
  
  // Modal/Toast/Snackbar states
  const [modalVisible, setModalVisible] = useState(false)
  const [modal2Visible, setModal2Visible] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [snackVisible, setSnackVisible] = useState(false)


  return (
    <>
      <ScrollView
          contentContainerStyle={{
          padding: S.space.md,
          gap: S.space.lg,
          paddingBottom: S.space.xxl,
          backgroundColor: $('background')
        }}
        showsVerticalScrollIndicator={false}
      >
        <ThemeSelector />

        <Card>
          <Heading>Typography Components</Heading>
          <View style={{ gap: S.space.sm, marginTop: S.space.md }}>
            <Title>Desktop Title</Title>
            <ObjHeading>Object Heading</ObjHeading>
            <Body>Body text for content.</Body>
            <Paragraph>Paragraph component.</Paragraph>
            <SubTitle>Subtitle text</SubTitle>
            <Caption>Caption text</Caption>
            <Link>Link text</Link>
          </View>
        </Card>

        <Card>
          <Heading>Button Variants</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <Button variant="primary" text={`Primary`} onPress={() => setPrimaryClicks(c => c + 1)} />
            <Button variant="secondary" text="Secondary" onPress={() => {}} />
            <Button variant="solid" text="Solid" onPress={() => {}} />
            <Button variant="outlined" text="Outlined" onPress={() => {}} />
            <Button variant="ghost" text="Ghost" onPress={() => {}} />
            <Button variant="destructive" text="Destructive" onPress={() => {}} />
            <Button variant="cancel" text="Cancel" onPress={() => {}} />
            <Caption>Primary clicks: {primaryClicks}</Caption>
          </View>
        </Card>

        <Card>
          <Heading>Icon Buttons</Heading>
          <View style={{ flexDirection: 'row', gap: S.space.sm, marginTop: S.space.md }}>
            <IconButton content="🗡️" onPress={() => setIconButtonClicks('Sword')} />
            <IconButton content="🏹" onPress={() => setIconButtonClicks('Bow')} />
            <IconButton content="🪄" onPress={() => setIconButtonClicks('Wand')} />
          </View>
          <Caption style={{ marginTop: S.space.sm }}>Last icon clicked: {iconButtonClicks || 'None'}</Caption>
        </Card>

        <Card>
          <Heading>Button Group</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <ButtonGroup
              ref={buttonGroupRef}
              items={[
                { key: 'melee', label: 'Melee' },
                { key: 'ranged', label: 'Ranged' },
                { key: 'magic', label: 'Magic' },
              ]}
              direction="horizontal"
            />
          </View>
        </Card>

        <Card>
          <Heading>Text Inputs</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <TextInput 
              heading="Search" 
              placeholder="Type here..." 
              value={textInputValue}
              onChangeText={setTextInputValue}
            />
            <Caption>TextInput value: {textInputValue || '(empty)'}</Caption>
            
            <DescInput 
              heading="Notes" 
              placeholder="Enter description..."
              value={descInputValue}
              onChangeText={setDescInputValue}
            />
            <Caption>DescInput value: {descInputValue || '(empty)'}</Caption>
          </View>
        </Card>

        <Card>
          <Heading>Input Group</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <TextInputGroup
              ref={textInputGroupRef}
              items={[
                { key: 'name', heading: 'Name', placeholder: 'Character name' },
                { key: 'level', heading: 'Level', placeholder: 'Level' },
              ]}
            />
          </View>
        </Card>

        <Card>
          <Heading>Dropdown</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <Dropdown
              enableSearch={true}
              heading="Select Class"
              items={[
                { label: 'Barbarian', value: 'barbarian' },
                { label: 'Bard', value: 'bard' },
                { label: 'Cleric', value: 'cleric' },
                { label: 'Druid', value: 'druid' },
                { label: 'Fighter', value: 'fighter' },
                { label: 'Monk', value: 'monk' },
                { label: 'Paladin', value: 'paladin' },
                { label: 'Ranger', value: 'ranger' },
                { label: 'Rogue', value: 'rogue' },
                { label: 'Sorcerer', value: 'sorcerer' },
                { label: 'Warlock', value: 'warlock' },
                { label: 'Wizard', value: 'wizard' },
              ]}
              value={dropdownValue}
              onChange={setDropdownValue}
            />
            <Caption>Selected class: {dropdownValue || 'None'}</Caption>
          </View>
        </Card>

        <Card>
          <Heading>Dropdown Group</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <DropdownGroup
              ref={dropdownGroupRef}
              items={[
                {
                  key: 'background',
                  heading: 'Background',
                  options: [
                    { label: 'Acolyte', value: 'acolyte' },
                    { label: 'Criminal', value: 'criminal' },
                    { label: 'Folk Hero', value: 'folk-hero' },
                    { label: 'Noble', value: 'noble' },
                    { label: 'Sage', value: 'sage' },
                    { label: 'Soldier', value: 'soldier' },
                  ],
                },
                {
                  key: 'skill',
                  heading: 'Skill Proficiency',
                  options: [
                    { label: 'Acrobatics', value: 'acrobatics' },
                    { label: 'Arcana', value: 'arcana' },
                    { label: 'Athletics', value: 'athletics' },
                    { label: 'Deception', value: 'deception' },
                    { label: 'History', value: 'history' },
                    { label: 'Insight', value: 'insight' },
                    { label: 'Intimidation', value: 'intimidation' },
                    { label: 'Investigation', value: 'investigation' },
                  ],
                },
              ]}
            />
          </View>
        </Card>

        <Card>
          <Heading>Switch</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <Switch heading="Dark Mode" checked={switchOn} onChange={setSwitchOn} />
            <Caption>Switch is: {switchOn ? 'ON' : 'OFF'}</Caption>
          </View>
        </Card>

        <Card>
          <Heading>Switch Group</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <SwitchGroup
              ref={switchGroupRef}
              title="Features"
              items={[
                { key: 'auto-save', heading: 'Auto Save' },
                { key: 'notifications', heading: 'Notifications' },
              ]}
            />
          </View>
        </Card>

        <Card>
          <Heading>Switch Group (Exclusive)</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <SwitchGroup
              ref={switchGroupExclusiveRef}
              title="Difficulty"
              exclusive
              items={[
                { key: 'easy', heading: 'Easy' },
                { key: 'normal', heading: 'Normal' },
                { key: 'hard', heading: 'Hard' },
              ]}
            />
          </View>
        </Card>

        <Card>
          <Heading>Switch Group (Max 3)</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <SwitchGroup
              ref={switchGroupMaxRef}
              title="Spell Schools"
              maxActive={3}
              items={[
                { key: 'abjuration', heading: 'Abjuration' },
                { key: 'conjuration', heading: 'Conjuration' },
                { key: 'divination', heading: 'Divination' },
                { key: 'enchantment', heading: 'Enchantment' },
                { key: 'evocation', heading: 'Evocation' },
              ]}
            />
          </View>
        </Card>

        <Card>
          <Heading>Radio Button Group</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <RadioButtonGroup
              ref={radioGroupRef}
              title="Faction"
              direction="horizontal"
              items={[
                { key: 'order', label: 'Order' },
                { key: 'chaos', label: 'Chaos' },
              ]}
            />
          </View>
        </Card>

        <Card>
          <Heading>Toggle Group</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <ToggleGroup
              ref={toggleGroupRef}
              title="Tools"
              items={[
                { key: 'map', icon: <Text>🗺️</Text> },
                { key: 'quill', icon: <Text>🪶</Text> },
                { key: 'potion', icon: <Text>🧪</Text> },
              ]}
            />
          </View>
        </Card>

        <Card>
          <Heading>Tabs</Heading>
          <View style={{ marginTop: S.space.md }}>
            <Tabs
              bottomSpace={tabValue !== 'headings'}
              tabs={[
                { key: 'overview', label: 'Overview' },
                { key: 'headings', label: 'Headings' },
                { key: 'body', label: 'Body' },
                { key: 'other', label: 'Other' },
              ]}
              onChange={setTabValue}
            />
            <View style={{ gap: S.space.sm, marginTop: S.space.md }}>
              {tabValue === 'overview' && (
                <>
                  <Body style={{ marginBottom: S.space.md }}>
                    This tab demonstrates all available font sizes and their visual hierarchy. 
                    Each heading level and text style is designed to work together for consistent typography.
                  </Body>
                </>
              )}
              {tabValue === 'headings' && (
                <>
                  <Tabs
                    bottomSpace={false}
                    tabs={[
                      { key: 'textPrimary', label: 'Primary' },
                      { key: 'textSecondary', label: 'Secondary' },
                      { key: 'textInverse', label: 'Inverse' },
                      { key: 'textOnAccent', label: 'On Accent' },
                    ]}
                    onChange={setColorTabValue}
                  />
                  <View 
                    style={{ 
                      padding: S.space.md, 
                      borderRadius: S.radius.md,
                      backgroundColor: 
                        colorTabValue === 'textPrimary' ? $('background') :
                        colorTabValue === 'textSecondary' ? $('surface') :
                        colorTabValue === 'textInverse' ? $('textPrimary') :
                        $('accent')
                    }}
                  >
                    <Heading 
                      fontSize='$heading1' 
                      color={
                        colorTabValue === 'textPrimary' ? '$textPrimary' :
                        colorTabValue === 'textSecondary' ? '$textSecondary' :
                        colorTabValue === 'textInverse' ? '$textInverse' :
                        '$textOnAccent'
                      }
                    >
                      Heading 1
                    </Heading>
                    <Heading 
                      fontSize='$heading2' 
                      color={
                        colorTabValue === 'textPrimary' ? '$textPrimary' :
                        colorTabValue === 'textSecondary' ? '$textSecondary' :
                        colorTabValue === 'textInverse' ? '$textInverse' :
                        '$textOnAccent'
                      }
                    >
                      Heading 2
                    </Heading>
                    <Heading 
                      fontSize='$heading3' 
                      color={
                        colorTabValue === 'textPrimary' ? '$textPrimary' :
                        colorTabValue === 'textSecondary' ? '$textSecondary' :
                        colorTabValue === 'textInverse' ? '$textInverse' :
                        '$textOnAccent'
                      }
                    >
                      Heading 3
                    </Heading>
                    <ObjHeading 
                      color={
                        colorTabValue === 'textPrimary' ? '$textPrimary' :
                        colorTabValue === 'textSecondary' ? '$textSecondary' :
                        colorTabValue === 'textInverse' ? '$textInverse' :
                        '$textOnAccent'
                      }
                    >
                      Object Heading
                    </ObjHeading>
                    <SubTitle 
                      color={
                        colorTabValue === 'textPrimary' ? '$textPrimary' :
                        colorTabValue === 'textSecondary' ? '$textSecondary' :
                        colorTabValue === 'textInverse' ? '$textInverse' :
                        '$textOnAccent'
                      }
                    >
                      SubTitle
                    </SubTitle>
                  </View>
                </>
              )}
              {tabValue === 'body' && (
                <>
                  <Body fontSize="$body1">Body 1 text example for normal content.</Body>
                  <Body fontSize="$body2">Body 2 text example for normal content.</Body>
                  <Body fontSize="$body3">Body 3 text example for normal content.</Body>
                  <Paragraph>Paragraph component for longer text blocks with proper line height and spacing.</Paragraph>
                </>
              )}
              {tabValue === 'other' && (
                <>
                  <Link>Link text for navigation</Link>
                  <Caption>Caption text for small notes</Caption>
                </>
              )}
            </View>
          </View>
        </Card>

        <Card>
          <Accordion title="Accordion Component" defaultOpen>
            <Body>
              The accordion component allows you to collapse and expand content sections. 
              This is particularly useful for organizing large amounts of information in a compact, 
              user-friendly way. Click the header to toggle the visibility of this content. 
              You can use accordions for FAQs, settings panels, or any hierarchical content structure 
              where users might want to focus on specific sections at a time.
            </Body>
            <Caption style={{ marginTop: S.space.sm }}>
              Toggle the accordion header to test expand/collapse behavior and animations.
            </Caption>
          </Accordion>
        </Card>

        <Card>
          <Heading>Modals, Toasts & Snackbars</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <Button text="Open Modal" onPress={() => setModalVisible(true)} />
            <Button text="Open Custom Modal" onPress={() => setModal2Visible(true)} />
            <Button text="Show Toast" onPress={() => setToastVisible(true)} />
            <Button text="Show Snackbar" onPress={() => setSnackVisible(true)} />
          </View>
        </Card>

        <Card>
          <Heading>Notifications (In-App)</Heading>
          <Body style={{ marginBottom: S.space.md }}>
            Notifications appear at the top (keyboard-safe on mobile!)
          </Body>
          <View style={{ gap: S.space.md, marginTop: S.space.md }}>
            <Button 
              text="Message Notification" 
              onPress={() => showNotification({
                type: 'message',
                title: 'New Message',
                message: 'Sarah sent you a message',
                timestamp: new Date()
              })} 
            />
            <Button 
              text="Update Notification" 
              onPress={() => showNotification({
                type: 'update',
                title: 'World Updated',
                message: 'John added a new location',
                timestamp: new Date(Date.now() - 300000)
              })} 
            />
            <Button 
              text="Alert Notification" 
              onPress={() => showNotification({
                type: 'alert',
                title: 'Connection Lost',
                message: 'Unable to sync. Retrying...'
              })} 
            />
            <Button 
              text="Info Notification" 
              onPress={() => showNotification({
                type: 'info',
                title: 'Tip',
                message: 'Customize theme in settings'
              })} 
            />
            <Button 
              variant="outlined"
              text="Show Stack (3)" 
              onPress={() => {
                showNotification({
                  type: 'message',
                  title: 'Player 1',
                  message: 'Ready!',
                  timestamp: new Date()
                })
                setTimeout(() => showNotification({
                  type: 'update',
                  title: 'Quest Available',
                  message: 'New content unlocked',
                  timestamp: new Date()
                }), 400)
                setTimeout(() => showNotification({
                  type: 'info',
                  title: 'System',
                  message: 'All players online',
                  timestamp: new Date()
                }), 800)
              }} 
            />
          </View>
        </Card>

        <Card>
          <Heading>Loading Spinner</Heading>
          <View style={{ flexDirection: 'row', gap: S.space.md, marginTop: S.space.md }}>
            <CustomLoad size="small" />
            <CustomLoad size="large" />
          </View>
        </Card>

        <Card>
          <Heading>Gradient Demo</Heading>
          <Heading>🌈 Gradient System Demo</Heading>
                <Body style={{ marginBottom: S.space.xl }}>
                  Tight, dramatic gradients from light to dark
                </Body>
          
                {/* Cards with Gradients */}
                <Heading style={{ marginTop: S.space.xl, marginBottom: S.space.md }}>
                  Cards (Dramatic Gradient by Default)
                </Heading>
          
                <View style={{ marginBottom: S.space.lg, gap: S.space.md }}>
                  <Card gradient>
                    <SubTitle>Dramatic Top-to-Bottom (Default)</SubTitle>
                    <Body>Tight transition at 70% for strong depth effect</Body>
                  </Card>
          
                  <Card gradient gradientDirection={0}>
                    <SubTitle>Dramatic Bottom-to-Top</SubTitle>
                    <Body>Inverted gradient for alternative styling</Body>
                  </Card>
          
                  <Card gradient gradientIntensity={20}>
                    <SubTitle>Moderate Intensity</SubTitle>
                    <Body>Softer transition, less contrast</Body>
                  </Card>
          
                  <Card gradient gradientIntensity={10}>
                    <SubTitle>Subtle Intensity</SubTitle>
                    <Body>Very gentle gradient, barely noticeable</Body>
                  </Card>
          
                  <Card gradient toneVariant="accent">
                    <SubTitle>Accent Variant with Gradient</SubTitle>
                    <Body>Gradient applied to accent-toned background</Body>
                  </Card>
                </View>
          
                {/* Surfaces with Gradients */}
                <Heading style={{ marginTop: S.space.xl, marginBottom: S.space.md }}>
                  Surfaces (Subtle Gradient by Default)
                </Heading>
          
                <View style={{ marginBottom: S.space.lg, gap: S.space.md }}>
                  <Surface gradient>
                    <SubTitle>Subtle Top-to-Bottom (Default)</SubTitle>
                    <Body>Gentle gradient for large background panels</Body>
                  </Surface>
          
                  <Surface gradient gradientIntensity={30}>
                    <SubTitle>Dramatic Surface</SubTitle>
                    <Body>More pronounced gradient on surface</Body>
                  </Surface>
          
                  <Surface gradient variant="alt">
                    <SubTitle>Elevated Variant with Gradient</SubTitle>
                    <Body>Gradient on elevated surface tone</Body>
                  </Surface>
                </View>
          
                {/* Comparison */}
                <Heading style={{ marginTop: S.space.xl, marginBottom: S.space.md }}>
                  Side-by-Side Comparison
                </Heading>
          
                <View style={{ flexDirection: 'row', gap: S.space.md, marginBottom: S.space.xxl }}>
                  <Card style={{ flex: 1 }}>
                    <SubTitle>No Gradient</SubTitle>
                    <Body>Flat background</Body>
                  </Card>
          
                  <Card gradient style={{ flex: 1 }}>
                    <SubTitle>With Gradient</SubTitle>
                    <Body>Dramatic depth</Body>
                  </Card>
                </View>
        </Card>

        <Card style={{ marginBottom: S.space.xl }}>
          <Heading>Tooltips</Heading>
          <View style={{ gap: S.space.md, marginTop: S.space.md, alignItems: 'flex-start' }}>
            <AppTooltip text="This is a helpful tooltip!">
              <Button variant="outlined" text="Hover or Press Me" onPress={() => {}} />
            </AppTooltip>
            
            <AppTooltip text="Tooltips work on any component" delay={300}>
              <Body>Hover over this text</Body>
            </AppTooltip>
            
            <AppTooltip text="Quick tooltip" delay={100}>
              <IconButton content="ℹ️" onPress={() => {}} />
            </AppTooltip>
          </View>
        </Card>
      </ScrollView>

      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        heading="Modal Test"
        body="Mobile Modal Example - This modal uses heading and body props"
      />

      <AppModal
        visible={modal2Visible}
        onClose={() => setModal2Visible(false)}
        heading="Custom Modal"
      >
        <View style={{ gap: S.space.md }}>
          <Body>This modal demonstrates using custom children alongside the heading prop</Body>
          <Button text="Close" onPress={() => setModal2Visible(false)} />
        </View>
      </AppModal>

      <AppToast
        message="Hello from Mobile!"
        visible={toastVisible}
        type="info"
        onHide={() => setToastVisible(false)}
      />

      <SnackBar
        visible={snackVisible}
        message="Saved successfully"
        tone="success"
        onHide={() => setSnackVisible(false)}
      />

      {/* Notification Container - renders all active notifications */}
      <NotificationContainer />
    </>
  )
}
