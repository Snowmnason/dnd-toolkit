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
  ToggleGroup,
} from '@/components/ui'
import { AppSplitView } from '@/components/ui/AppView'
import { $, useScale } from '@/theme'
import React, { useState } from 'react'
import { Text, View } from 'react-native'

export default function StyleDesktop() {
  const S = useScale()
  // Button states
  const [primaryClicks, setPrimaryClicks] = useState(0)
  const [iconButtonClicks, setIconButtonClicks] = useState('')
  const buttonGroupRef = React.useRef<any>(null)
  
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
  const [tabValue, setTabValue] = useState('overview')
  
  // Modal/Toast/Snackbar states
  const [modalVisible, setModalVisible] = useState(false)
  const [modal2Visible, setModal2Visible] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [snackVisible, setSnackVisible] = useState(false)

  return (
    <AppSplitView
      left={
        <View style={{ gap: S.space.lg }}>
          <ThemeSelector />

          <Card>
            <Heading>Typography Components</Heading>
            <Title>Desktop Title</Title>
            <ObjHeading>Object Heading</ObjHeading>
            <Body>Body text for content.</Body>
            <Paragraph>Paragraph component.</Paragraph>
            <SubTitle>Subtitle text</SubTitle>
            <Caption>Caption text</Caption>
            <Link>Link text</Link>
          </Card>

          <Card>
            <Heading>Button Tests</Heading>
            <Button variant="primary" text={`Primary (${primaryClicks})`} onPress={() => setPrimaryClicks(c => c + 1)} />
            <Caption>Primary clicks: {primaryClicks}</Caption>
            
            <Button text="Open Modal" onPress={() => setModalVisible(true)} />
            <Button text="Show Toast" onPress={() => setToastVisible(true)} />
            <Button text="Show Snackbar" onPress={() => setSnackVisible(true)} />
          </Card>

          <Card>
            <Heading>Icon Buttons</Heading>
            <View style={{ flexDirection: 'row', gap: S.space.sm }}>
              <IconButton icon="🗡️" onPress={() => setIconButtonClicks('Sword')} />
              <IconButton icon="🏹" onPress={() => setIconButtonClicks('Bow')} />
              <IconButton icon="🪄" onPress={() => setIconButtonClicks('Wand')} />
            </View>
            <Caption>Last icon clicked: {iconButtonClicks || 'None'}</Caption>
          </Card>

          <Card>
            <Heading>Button Group</Heading>
            <ButtonGroup
              ref={buttonGroupRef}
              items={[
                { key: 'melee', label: 'Melee' },
                { key: 'ranged', label: 'Ranged' },
                { key: 'magic', label: 'Magic' },
              ]}
              direction="horizontal"
            />
            <Button 
              variant="outlined" 
              text="Get Selected" 
              onPress={() => {
                const value = buttonGroupRef.current?.getValue()
                alert(`ButtonGroup selected: ${value || 'None'}`)
              }} 
            />
          </Card>

          <Card>
            <Heading>Text Inputs</Heading>
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
          </Card>

          <Card>
            <Heading>Input Group</Heading>
            <TextInputGroup
              ref={textInputGroupRef}
              items={[
                { key: 'name', heading: 'Name', placeholder: 'Character name' },
                { key: 'level', heading: 'Level', placeholder: 'Level' },
              ]}
            />
            <Button 
              variant="outlined" 
              text="Get All Values" 
              onPress={() => {
                const values = textInputGroupRef.current?.getValues()
                alert(`TextInputGroup values:\n${JSON.stringify(values, null, 2)}`)
              }} 
            />
          </Card>

          <Card>
            <Heading>Dropdown</Heading>
            <Dropdown
              heading="Select Race"
              items={[
                { label: 'Human', value: 'human' },
                { label: 'Elf', value: 'elf' },
                { label: 'Dwarf', value: 'dwarf' },
              ]}
              value={dropdownValue}
              onChange={setDropdownValue}
            />
            <Caption>Selected race: {dropdownValue || 'None'}</Caption>
          </Card>

          <Card>
            <Heading>Dropdown Group</Heading>
            <DropdownGroup
              ref={dropdownGroupRef}
              items={[
                {
                  key: 'alignment',
                  heading: 'Alignment',
                  options: [
                    { label: 'Lawful Good', value: 'lg' },
                    { label: 'Chaotic Evil', value: 'ce' },
                  ],
                },
                {
                  key: 'deity',
                  heading: 'Deity',
                  options: [
                    { label: 'Pelor', value: 'pelor' },
                    { label: 'Lolth', value: 'lolth' },
                  ],
                },
              ]}
            />
            <Button 
              variant="outlined" 
              text="Get All Values" 
              onPress={() => {
                const values = dropdownGroupRef.current?.getValues()
                alert(`DropdownGroup values:\n${JSON.stringify(values, null, 2)}`)
              }} 
            />
          </Card>

          <Card>
            <Heading>Switch</Heading>
            <Switch heading="Dark Mode" checked={switchOn} onChange={setSwitchOn} />
            <Caption>Switch is: {switchOn ? 'ON' : 'OFF'}</Caption>
          </Card>

          <Card>
            <Heading>Switch Group</Heading>
            <SwitchGroup
              ref={switchGroupRef}
              title="Features"
              items={[
                { key: 'auto-save', heading: 'Auto Save' },
                { key: 'notifications', heading: 'Notifications' },
              ]}
            />
            <Button 
              variant="outlined" 
              text="Get All Values" 
              onPress={() => {
                const values = switchGroupRef.current?.getValues()
                alert(`SwitchGroup values:\n${JSON.stringify(values, null, 2)}`)
              }} 
            />
          </Card>

          <Card>
            <Heading>Radio Button Group</Heading>
            <RadioButtonGroup
              ref={radioGroupRef}
              title="Faction"
              direction="horizontal"
              items={[
                { key: 'order', label: 'Order' },
                { key: 'chaos', label: 'Chaos' },
              ]}
            />
            <Button 
              variant="outlined" 
              text="Get Selected" 
              onPress={() => {
                const value = radioGroupRef.current?.getValue()
                alert(`RadioButtonGroup selected: ${value || 'None'}`)
              }} 
            />
          </Card>

          <Card>
            <Heading>Toggle Group</Heading>
            <ToggleGroup
              ref={toggleGroupRef}
              title="Tools"
              items={[
                { key: 'map', icon: <Text>🗺️</Text> },
                { key: 'quill', icon: <Text>🪶</Text> },
                { key: 'potion', icon: <Text>🧪</Text> },
              ]}
            />
            <Button 
              variant="outlined" 
              text="Get All Values" 
              onPress={() => {
                const values = toggleGroupRef.current?.getValues()
                alert(`ToggleGroup values:\n${JSON.stringify(values, null, 2)}`)
              }} 
            />
          </Card>

          <Card>
            <Heading>Tabs</Heading>
            <Tabs
              tabs={[
                { key: 'overview', label: 'Overview' },
                { key: 'stats', label: 'Stats' },
                { key: 'settings', label: 'Settings' },
              ]}
              onChange={setTabValue}
            />
            <Caption>Current tab: {tabValue}</Caption>
          </Card>

          <Accordion title="About this UI" defaultOpen>
            <Body>
              A comprehensive interactive test environment for every reusable component in the design system.
            </Body>
            <Caption>Toggle accordion to test expand/collapse behavior</Caption>
          </Accordion>

          <Card>
            <Text style={{ color: $('textPrimary'), fontWeight: '700' }}>Loading Spinner</Text>
            <View style={{ flexDirection: 'row', gap: S.space.md }}>
              <CustomLoad size="small" />
              <CustomLoad size="large" />
            </View>
          </Card>
        </View>
      }
      right={
        <View style={{ gap: S.space.lg }}>
          <Surface>
            <Title>Component State Overview</Title>
            <Body>This panel displays the current state of all interactive components on the left.</Body>
          </Surface>

          <Card>
            <Heading>Button States</Heading>
            <Body>Primary button clicks: {primaryClicks}</Body>
            <Body>Last icon clicked: {iconButtonClicks || 'None'}</Body>
          </Card>

          <Card>
            <Heading>Input States</Heading>
            <Body>TextInput: {textInputValue || '(empty)'}</Body>
            <Body>DescInput: {descInputValue || '(empty)'}</Body>
          </Card>

          <Card>
            <Heading>Selection States</Heading>
            <Body>Dropdown: {dropdownValue || 'None'}</Body>
            <Body>Active Tab: {tabValue}</Body>
            <Body>Switch: {switchOn ? 'ON' : 'OFF'}</Body>
          </Card>

          <Card>
            <Heading>Additional Tests</Heading>
            <Button text="Open Second Modal" onPress={() => setModal2Visible(true)} />
            <Button variant="outlined" text="Test All Refs" onPress={() => {
              const buttonGroup = buttonGroupRef.current?.getValue()
              const inputGroup = textInputGroupRef.current?.getValues()
              const dropdownGroup = dropdownGroupRef.current?.getValues()
              const switchGroup = switchGroupRef.current?.getValues()
              const radioGroup = radioGroupRef.current?.getValue()
              const toggleGroup = toggleGroupRef.current?.getValues()
              
              alert(`All Ref Values:\n\nButtonGroup: ${buttonGroup}\nRadioGroup: ${radioGroup}\n\nInputGroup: ${JSON.stringify(inputGroup, null, 2)}\n\nDropdownGroup: ${JSON.stringify(dropdownGroup, null, 2)}\n\nSwitchGroup: ${JSON.stringify(switchGroup, null, 2)}\n\nToggleGroup: ${JSON.stringify(toggleGroup, null, 2)}`)
            }} />
          </Card>
        </View>
      }
    >
      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        heading="Modal Test"
        body="Desktop Modal Example - This modal uses heading and body props"
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
        message="Hello from Desktop!"
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
    </AppSplitView>
  )
}
