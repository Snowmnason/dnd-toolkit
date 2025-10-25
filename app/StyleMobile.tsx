import { ThemeSelector } from '@/components/settings/ThemeSelector'
import {
  Accordion,
  AppModal,
  AppToast,
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
  InteractiveCard,
  Link,
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
import { AppView } from '@/components/ui/AppView'
import { useScale } from '@/theme'
import React, { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

export default function StyleMobile() {
  const S = useScale()
  // Button states
  const [primaryClicks, setPrimaryClicks] = useState(0)
  const [secondaryClicks, setSecondaryClicks] = useState(0)
  const [destructiveClicks, setDestructiveClicks] = useState(0)
  const [ghostClicks, setGhostClicks] = useState(0)
  const [outlinedClicks, setOutlinedClicks] = useState(0)
  const [iconButtonClicks, setIconButtonClicks] = useState('')
  
  // Input states
  const [textInputValue, setTextInputValue] = useState('')
  const [descInputValue, setDescInputValue] = useState('')
  const textInputGroupRef = React.useRef<any>(null)
  
  // Dropdown states
  const [dropdownValue, setDropdownValue] = useState<string | null>(null)
  const dropdownGroupRef = React.useRef<any>(null)
  
  // Switch states
  const [switchOn, setSwitchOn] = useState(false)
  const switchGroupRef = React.useRef<any>(null)
  
  // Radio & Toggle states
  const radioGroupRef = React.useRef<any>(null)
  const toggleGroupRef = React.useRef<any>(null)
  
  // Tab state
  const [tabValue, setTabValue] = useState('tab1')
  
  // Modal/Toast/Snackbar states
  const [modalVisible, setModalVisible] = useState(false)
  const [modal2Visible, setModal2Visible] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [snackVisible, setSnackVisible] = useState(false)
  


  return (
    <AppView scroll>
      <ScrollView
        contentContainerStyle={{
          gap: S.space.xl,
          paddingBottom: S.space.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ThemeSelector />

        <Card>
          <Heading>Typography Components</Heading>
          <Title>This is a Title</Title>
          <ObjHeading>Object Heading</ObjHeading>
          <Body>Body text for regular content with standard styling.</Body>
          <Paragraph>This is a paragraph component with paragraph-specific styling.</Paragraph>
          <SubTitle>Subtitle text for secondary information</SubTitle>
          <Caption>Caption text for small annotations</Caption>
          <Link>Link text component</Link>
        </Card>

        <Card>
          <ObjHeading>Button Variants</ObjHeading>
          <View style={{ gap: S.space.sm }}>
            <Button text={`Primary (${primaryClicks})`} onPress={() => setPrimaryClicks(c => c + 1)} />
            <Caption>Primary clicks: {primaryClicks}</Caption>
            
            <Button variant="secondary" text={`Secondary (${secondaryClicks})`} onPress={() => setSecondaryClicks(c => c + 1)} />
            <Caption>Secondary clicks: {secondaryClicks}</Caption>
            
            <Button variant="destructive" text={`Destructive (${destructiveClicks})`} onPress={() => setDestructiveClicks(c => c + 1)} />
            <Caption>Destructive clicks: {destructiveClicks}</Caption>
            
            <Button variant="ghost" text={`Ghost (${ghostClicks})`} onPress={() => setGhostClicks(c => c + 1)} />
            <Caption>Ghost clicks: {ghostClicks}</Caption>
            
            <Button variant="outlined" text={`Outlined (${outlinedClicks})`} onPress={() => setOutlinedClicks(c => c + 1)} />
            <Caption>Outlined clicks: {outlinedClicks}</Caption>
            
            <Button loading text="Loading State" />
            <Caption>Loading button (disabled)</Caption>
          </View>
        </Card>

        <Card>
          <ObjHeading>Icon Buttons</ObjHeading>
          <View style={{ flexDirection: 'row', gap: S.space.sm, flexWrap: 'wrap' }}>
            <IconButton icon="⚔️" onPress={() => setIconButtonClicks('Sword')} />
            <IconButton icon="🛡️" onPress={() => setIconButtonClicks('Shield')} />
            <IconButton icon="✨" onPress={() => setIconButtonClicks('Magic')} />
          </View>
          <Caption>Last clicked: {iconButtonClicks || 'None'}</Caption>
        </Card>

        <Card>
          <ObjHeading>Button Group (Exclusive Selection)</ObjHeading>
          <ButtonGroup
            items={[
              { key: 'attack', label: 'Attack' },
              { key: 'defend', label: 'Defend' },
              { key: 'cast', label: 'Cast' },
            ]}
            defaultSelected="attack"
          />
          <Caption>Selected: Check component internal state</Caption>
        </Card>

        <Card>
          <ObjHeading>Text Inputs</ObjHeading>
          <TextInput 
            heading="Username" 
            placeholder="Type here..." 
            value={textInputValue}
            onChangeText={setTextInputValue}
          />
          <Caption>Value: {textInputValue || '(empty)'}</Caption>
          
          <DescInput 
            heading="Description" 
            placeholder="Tell us something..." 
            value={descInputValue}
            onChangeText={setDescInputValue}
          />
          <Caption>Description length: {descInputValue.length} characters</Caption>
        </Card>

        <Card>
          <ObjHeading>Text Input Group</ObjHeading>
          <TextInputGroup
            ref={textInputGroupRef}
            items={[
              { key: 'name', heading: 'Character Name', placeholder: 'Enter name' },
              { key: 'class', heading: 'Class', placeholder: 'Enter class' },
            ]}
          />
          <Button 
            text="Get All Values" 
            variant="secondary"
            onPress={() => {
              const values = textInputGroupRef.current?.getValues()
              alert(JSON.stringify(values, null, 2))
            }}
          />
          <Caption>Click button to see all input values</Caption>
        </Card>

        <Card>
          <ObjHeading>Dropdown Group</ObjHeading>
          <DropdownGroup
            ref={dropdownGroupRef}
            items={[
              {
                key: 'race',
                heading: 'Race',
                options: [
                  { label: 'Human', value: 'human' },
                  { label: 'Elf', value: 'elf' },
                  { label: 'Dwarf', value: 'dwarf' },
                ],
              },
              {
                key: 'class',
                heading: 'Class',
                options: [
                  { label: 'Warrior', value: 'warrior' },
                  { label: 'Mage', value: 'mage' },
                  { label: 'Rogue', value: 'rogue' },
                ],
              },
            ]}
          />
          <Button 
            text="Get All Selections" 
            variant="secondary"
            onPress={() => {
              const values = dropdownGroupRef.current?.getValues()
              alert(JSON.stringify(values, null, 2))
            }}
          />
          <Caption>Click button to see all dropdown selections</Caption>
        </Card>


        <Card>
          <ObjHeading>Switch</ObjHeading>
          <Switch
            heading="Enable Notifications"
            checked={switchOn}
            onChange={setSwitchOn}
            leftLabel="Off"
            rightLabel="On"
          />
          <Caption>Status: {switchOn ? 'ON ✓' : 'OFF ✗'}</Caption>
        </Card>

        <Card>
          <ObjHeading>Switch Group</ObjHeading>
          <SwitchGroup
            ref={switchGroupRef}
            title="Settings"
            items={[
              { key: 'sound', heading: 'Sound' },
              { key: 'music', heading: 'Music' },
              { key: 'vibration', heading: 'Vibration' },
            ]}
          />
          <Button 
            text="Get All Switch States" 
            variant="secondary"
            onPress={() => {
              const values = switchGroupRef.current?.getValues()
              alert(JSON.stringify(values, null, 2))
            }}
          />
          <Caption>Click button to see all switch states</Caption>
        </Card>

        <Card>
          <ObjHeading>Radio Button Group</ObjHeading>
          <RadioButtonGroup
            ref={radioGroupRef}
            title="Choose Difficulty"
            items={[
              { key: 'easy', label: 'Easy' },
              { key: 'normal', label: 'Normal' },
              { key: 'hard', label: 'Hard' },
            ]}
            defaultSelected="normal"
          />
          <Button 
            text="Get Selected Difficulty" 
            variant="secondary"
            onPress={() => {
              const value = radioGroupRef.current?.getValue()
              alert(`Selected: ${value}`)
            }}
          />
          <Caption>Click button to see selection</Caption>
        </Card>

        <Card>
          <ObjHeading>Toggle Group (Multi-Select)</ObjHeading>
          <ToggleGroup
            ref={toggleGroupRef}
            title="Tools"
            items={[
              { key: 'pen', icon: <Text>✏️</Text> },
              { key: 'wand', icon: <Text>🪄</Text> },
              { key: 'sword', icon: <Text>⚔️</Text> },
            ]}
            outlined
          />
          <Button 
            text="Get Selected Tools" 
            variant="secondary"
            onPress={() => {
              const values = toggleGroupRef.current?.getValues()
              alert(`Selected: ${values.join(', ') || 'None'}`)
            }}
          />
          <Caption>Click button to see all selected tools</Caption>
        </Card>

        <Card>
          <ObjHeading>Tabs</ObjHeading>
          <Tabs
            tabs={[
              { key: 'tab1', label: 'Overview' },
              { key: 'tab2', label: 'Stats' },
              { key: 'tab3', label: 'Lore' },
            ]}
            onChange={setTabValue}
          />
          <Body style={{ marginTop: S.space.sm }}>
            Active Tab: <Caption style={{ fontWeight: '700' }}>{tabValue}</Caption>
          </Body>
        </Card>

        <Card>
          <ObjHeading>Dropdown</ObjHeading>
          <Dropdown
            items={[
              { label: 'Cleric', value: 'cleric' },
              { label: 'Rogue', value: 'rogue' },
              { label: 'Wizard', value: 'wizard' },
            ]}
            value={dropdownValue}
            onChange={setDropdownValue}
            heading="Select Class"
          />
          <Caption>Selected: {dropdownValue || 'None'}</Caption>
        </Card>

        <Card>
          <ObjHeading>Surface</ObjHeading>
          <Surface>
            <Body>Surface is a styled container component</Body>
            <Caption>Used for elevated content areas</Caption>
          </Surface>
        </Card>

        <Card>
          <ObjHeading>Interactive Card</ObjHeading>
          <InteractiveCard onPress={() => setPrimaryClicks(c => c + 1)}>
            <Body>Tap this card! 👆</Body>
            <Caption>Times tapped: {primaryClicks}</Caption>
          </InteractiveCard>
        </Card>

        <Card>
          <ObjHeading>Accordion</ObjHeading>
          <Accordion title="Lore Section" defaultOpen={false}>
            <Body>This section expands and collapses to show details.</Body>
            <Caption>Perfect for hiding/showing content!</Caption>
            <Body style={{ marginTop: S.space.sm }}>Click the title to expand/collapse</Body>
          </Accordion>
        </Card>

        <Card>
          <ObjHeading>Loading Spinner</ObjHeading>
          <View style={{ flexDirection: 'row', gap: S.space.lg, alignItems: 'center' }}>
            <View>
              <CustomLoad size="small" />
              <Caption>Small</Caption>
            </View>
            <View>
              <CustomLoad size="large" />
              <Caption>Large</Caption>
            </View>
          </View>
        </Card>

        <Card>
          <ObjHeading>Modals</ObjHeading>
          <View style={{ gap: S.space.sm }}>
            <Button text="Show Simple Modal" onPress={() => setModalVisible(true)} />
            <Button text="Show Custom Modal" variant="secondary" onPress={() => setModal2Visible(true)} />
          </View>
        </Card>
        
        <AppModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          heading="Simple Modal"
          body="This is a basic modal with just a message and close button!"
        />
        
        <AppModal
          visible={modal2Visible}
          onClose={() => setModal2Visible(false)}
          heading="Custom Modal"
        >
          <Body>This modal uses custom children instead of the body prop.</Body>
          <View style={{ gap: S.space.sm, marginTop: S.space.md }}>
            <Button text="Action 1" onPress={() => setModal2Visible(false)} />
            <Button text="Action 2" variant="secondary" onPress={() => setModal2Visible(false)} />
          </View>
        </AppModal>

        <Card>
          <ObjHeading>Toast Notifications</ObjHeading>
          <View style={{ gap: S.space.sm }}>
            <Button text="Show Success Toast" variant="secondary" onPress={() => setToastVisible(true)} />
          </View>
        </Card>
        
        <AppToast
          message="Hello Adventurer! This is a success toast! 🎉"
          type="success"
          visible={toastVisible}
          onHide={() => setToastVisible(false)}
        />

        <Card>
          <ObjHeading>Snackbar</ObjHeading>
          <View style={{ gap: S.space.sm }}>
            <Button text="Show Snackbar" variant="secondary" onPress={() => setSnackVisible(true)} />
          </View>
        </Card>
        
        <SnackBar
          visible={snackVisible}
          message="Action completed successfully!"
          tone="success"
          onHide={() => setSnackVisible(false)}
        />
      </ScrollView>
    </AppView>
  )
}
