/* eslint-disable @typescript-eslint/no-unused-vars */
import { ThemeSelector } from "@/AppScreens/settings/ThemeSelector";
import {
    Accordion,
    AppModal,
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
    ObjHeading,
    Paragraph,
    ProgressBar,
    RadioButtonGroup,
    SubTitle,
    Surface,
    Switch,
    SwitchGroup,
    Tabs,
    TextInput,
    TextInputGroup,
    Title,
    ToggleGroup
} from "@/components/ui";
import { AppSplit } from "@/components/ui/AppView";
import { useAppSnackbar } from "@/contexts/app-snackbar-context";
import { useAppToast } from "@/contexts/app-toast-context";
import { useNotifications } from "@/contexts/notifications-context";

import { useJobOperation } from "@/hooks/jobs/useJobOperation";
import { $, UseTheme, useScale } from "@/theme";
import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

export default function StyleDesktop() {
  const S = useScale();
  const { theme } = UseTheme();
  const { showNotification } = useNotifications();
  const { show: showToast } = useAppToast();
  const { show: showSnackbar } = useAppSnackbar();
  const { addJob, updateJob } = useJobOperation();

  // Simple display states (not controlling components, just for right panel display)
  const [primaryClicks, setPrimaryClicks] = useState(0);
  const [iconButtonClicks, setIconButtonClicks] = useState("");
  const [progressDisplay, setProgressDisplay] = useState(30);
  const [progressCircularDisplay, setProgressCircularDisplay] = useState(30);
  const [textInputValue, setTextInputValue] = useState("");
  const [descInputValue, setDescInputValue] = useState("");
  const [dropdownValue, setDropdownValue] = useState<string | null>(null);
  const [switchOn, setSwitchOn] = useState(false);
  const [tabValue, setTabValue] = useState("overview");

  // Display-only states for group values (populated when "Get Values" is clicked)
  const [buttonGroupValue, setButtonGroupValue] = useState<string>("");
  const [textInputGroupValues, setTextInputGroupValues] = useState<any>({});
  const [dropdownGroupValues, setDropdownGroupValues] = useState<any>({});
  const [switchGroupValues, setSwitchGroupValues] = useState<any>({});
  const [switchGroupExclusiveValue, setSwitchGroupExclusiveValue] =
    useState<string>("");
  const [switchGroupMaxValues, setSwitchGroupMaxValues] = useState<any>({});
  const [radioGroupValue, setRadioGroupValue] = useState<string>("");
  const [toggleGroupValues, setToggleGroupValues] = useState<any>({});
  const [colorTabValue, setColorTabValue] = useState("textPrimary");

  // Refs to access group components
  const buttonGroupRef = useRef<any>(null);
  const textInputGroupRef = useRef<any>(null);
  const dropdownGroupRef = useRef<any>(null);
  const switchGroupRef = useRef<any>(null);
  const switchGroupExclusiveRef = useRef<any>(null);
  const switchGroupMaxRef = useRef<any>(null);
  const radioGroupRef = useRef<any>(null);
  const toggleGroupRef = useRef<any>(null);
  const progressBarControlledRef = useRef<any>(null);
  const progressBarVariantRef = useRef<any>(null);
  const circularProgressRef = useRef<any>(null);

  // Modal/Toast/Snackbar states
  const [modalVisible, setModalVisible] = useState(false);
  const [modal2Visible, setModal2Visible] = useState(false);

  // Job Operation test handlers
  const handleAddSuccessfulUpload = () => {
    const jobId = `upload-success-${Date.now()}`;
    addJob({
      id: jobId,
      title: 'Uploading character sheet...',
      type: 'upload',
      status: 'pending',
      progress: 0,
      isUserInitiated: true,
      onCancel: () => console.log('Upload cancelled:', jobId),
    });

    // Simulate job progression: pending → active → completed
    setTimeout(() => {
      updateJob(jobId, { status: 'active', progress: 0 });
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 25;
        if (progress >= 100) {
          clearInterval(interval);
          updateJob(jobId, { status: 'completed', progress: 100 });
        } else {
          updateJob(jobId, { progress: Math.min(progress, 99) });
        }
      }, 300);
    }, 500);
  };

  const handleAddFailingDownload = () => {
    const jobId = `download-fail-${Date.now()}`;
    addJob({
      id: jobId,
      title: 'Downloading campaign data... (will take 30 seconds)',
      type: 'download',
      status: 'pending',
      progress: 0,
      isUserInitiated: true,
      onCancel: () => console.log('Download cancelled:', jobId),
      onRetry: () => handleAddFailingDownload(),
    });

    // Simulate job progression then fail mid-way
    setTimeout(() => {
      updateJob(jobId, { status: 'active', progress: 0 });
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 60) {
          clearInterval(interval);
          updateJob(jobId, {
            status: 'error',
            progress: 60,
            error: 'Network timeout after 30 seconds. Your internet is probably potato-quality.',
          });
        } else {
          updateJob(jobId, { progress: Math.min(progress, 59) });
        }
      }, 400);
    }, 500);
  };


  return (
    <AppSplit
      verticalPadding="none"
      horizontalPadding="xs"
      left={
        <ScrollView style={{}}>
          {/* Crash tester removed (was a hidden test helper) */}

          <ThemeSelector />

          <Surface style={{ marginTop: S.space.lg }}>
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
          </Surface>
          {/* Notifications system - re-enabled for testing */}
          <Surface style={{ marginTop: S.space.lg, marginBottom: S.space.lg }}>
            <Heading>Notifications (In-App)</Heading>
            <Body style={{ marginBottom: S.space.md }}>
              Test the notification queue system
            </Body>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <Button
                variant="primary"
                text="Show Info"
                onPress={() =>
                  showNotification({
                    type: "info",
                    title: "Info",
                    message: "This is an info notification",
                  })
                }
              />
              <Button
                variant="secondary"
                text="Show Update"
                onPress={() =>
                  showNotification({
                    type: "update",
                    title: "Update Available",
                    message: "A new version is available",
                  })
                }
              />
              <Button
                variant="solid"
                text="Show Alert"
                onPress={() =>
                  showNotification({
                    type: "alert",
                    title: "Alert",
                    message: "Important alert message",
                  })
                }
              />
              <Button
                variant="outlined"
                text="Show Message"
                onPress={() =>
                  showNotification({
                    type: "message",
                    title: "Message",
                    message: "You have a new message",
                  })
                }
              />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Button Variants</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <Button
                variant="primary"
                text={`Primary`}
                onPress={() => setPrimaryClicks((c) => c + 1)}
              />
              <Button variant="secondary" text="Secondary" onPress={() => {}} />
              <Button variant="solid" text="Solid" onPress={() => {}} />
              <Button variant="outlined" text="Outlined" onPress={() => {}} />
              <Button variant="ghost" text="Ghost" onPress={() => {}} />
              <Button
                variant="destructive"
                text="Destructive"
                onPress={() => {}}
              />
              <Button variant="cancel" text="Cancel" onPress={() => {}} />
              <Caption>Primary clicks: {primaryClicks}</Caption>
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Icon Buttons</Heading>
            <View
              style={{
                flexDirection: "row",
                gap: S.space.sm,
                marginTop: S.space.md,
              }}
            >
              <IconButton
                content="🗡️"
                onPress={() => setIconButtonClicks("Sword")}
              />
              <IconButton
                content="🏹"
                onPress={() => setIconButtonClicks("Bow")}
              />
              <IconButton
                content="🪄"
                onPress={() => setIconButtonClicks("Wand")}
              />
            </View>
            <Caption style={{ marginTop: S.space.sm }}>
              Last icon clicked: {iconButtonClicks || "None"}
            </Caption>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Progress Bar</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <ProgressBar
                ref={progressBarControlledRef}
                label={`Progress: ${progressDisplay}%`}
                animated
                initialProgress={30}
              />
              <View style={{ flexDirection: "row", gap: S.space.sm }}>
                <Button
                  variant="outlined"
                  text="-10"
                  onPress={() => {
                    progressBarControlledRef.current?.decrement(10);
                    progressBarVariantRef.current?.decrement(10);
                    setProgressDisplay(progressBarControlledRef.current?.getProgress() || 0);
                  }}
                />
                <Button
                  variant="outlined"
                  text="+10"
                  onPress={() => {
                    progressBarControlledRef.current?.increment(10);
                    progressBarVariantRef.current?.increment(10);
                    setProgressDisplay(progressBarControlledRef.current?.getProgress() || 0);
                  }}
                />
                <Button
                  variant="outlined"
                  text="Reset"
                  onPress={() => {
                    progressBarControlledRef.current?.reset();
                    progressBarVariantRef.current?.reset();
                    setProgressDisplay(0);
                  }}
                />
              </View>
              <ProgressBar
                ref={progressBarVariantRef}
                animated={false}
                highlightColor={theme.success}
                initialProgress={progressDisplay}
              />
              <Caption>Current progress: {progressDisplay}%</Caption>
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg, marginBottom: S.space.lg }}>
            <Heading>Progress Bar (Circular)</Heading>
            <View
              style={{
                flexDirection: "column",
                gap: S.space.xs,
                alignItems: "flex-start",
              }}
            >
              <ProgressBar 
                variant="circular" 
                ref={circularProgressRef} 
                initialProgress={30} 
                size={80} 
                label={`Progress: ${progressCircularDisplay}%`} 
              />
              <View style={{ flexDirection: "row", gap: S.space.sm}}>
                <Button text="-10" onPress={() => { circularProgressRef.current?.decrement(10);  setProgressCircularDisplay(circularProgressRef.current?.getProgress() || 0); }} />
                <Button text="+10" onPress={() => { circularProgressRef.current?.increment(10);  setProgressCircularDisplay(circularProgressRef.current?.getProgress() || 0); }} />
                <Button text="Reset" onPress={() => { circularProgressRef.current?.reset();  setProgressCircularDisplay(0); }} />
              </View>
            </View>
           
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Button Group</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <ButtonGroup
                ref={buttonGroupRef}
                items={[
                  { key: "melee", label: "Melee" },
                  { key: "ranged", label: "Ranged" },
                  { key: "magic", label: "Magic" },
                ]}
                direction="horizontal"
              />
              <Button
                variant="outlined"
                text="Get Selected"
                onPress={() => {
                  const value = buttonGroupRef.current?.getValue();
                  setButtonGroupValue(value || "");
                }}
              />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Text Inputs</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <TextInput
                heading="Search"
                placeholder="Type here..."
                value={textInputValue}
                onChangeText={setTextInputValue}
              />
              <Caption>TextInput value: {textInputValue || "(empty)"}</Caption>

              <DescInput
                heading="Notes"
                placeholder="Enter description..."
                value={descInputValue}
                onChangeText={setDescInputValue}
              />
              <Caption>DescInput value: {descInputValue || "(empty)"}</Caption>
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Input Group</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <TextInputGroup
                ref={textInputGroupRef}
                items={[
                  {
                    key: "name",
                    heading: "Name",
                    placeholder: "Character name",
                  },
                  { key: "level", heading: "Level", placeholder: "Level" },
                ]}
              />
              <Button
                variant="outlined"
                text="Get All Values"
                onPress={() => {
                  const values = textInputGroupRef.current?.getValues();
                  setTextInputGroupValues(values || {});
                }}
              />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Dropdown</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <Dropdown
                enableSearch={true}
                heading="Select Class"
                items={[
                  { label: "Barbarian", value: "barbarian" },
                  { label: "Bard", value: "bard" },
                  { label: "Cleric", value: "cleric" },
                  { label: "Druid", value: "druid" },
                  { label: "Fighter", value: "fighter" },
                  { label: "Monk", value: "monk" },
                  { label: "Paladin", value: "paladin" },
                  { label: "Ranger", value: "ranger" },
                  { label: "Rogue", value: "rogue" },
                  { label: "Sorcerer", value: "sorcerer" },
                  { label: "Warlock", value: "warlock" },
                  { label: "Wizard", value: "wizard" },
                ]}
                value={dropdownValue}
                onChange={setDropdownValue}
              />
              <Caption>Selected class: {dropdownValue || "None"}</Caption>
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Dropdown Group</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <DropdownGroup
                ref={dropdownGroupRef}
                items={[
                  {
                    key: "background",
                    heading: "Background",
                    options: [
                      { label: "Acolyte", value: "acolyte" },
                      { label: "Criminal", value: "criminal" },
                      { label: "Folk Hero", value: "folk-hero" },
                      { label: "Noble", value: "noble" },
                      { label: "Sage", value: "sage" },
                      { label: "Soldier", value: "soldier" },
                    ],
                  },
                  {
                    key: "skill",
                    heading: "Skill Proficiency",
                    options: [
                      { label: "Acrobatics", value: "acrobatics" },
                      { label: "Arcana", value: "arcana" },
                      { label: "Athletics", value: "athletics" },
                      { label: "Deception", value: "deception" },
                      { label: "History", value: "history" },
                      { label: "Insight", value: "insight" },
                      { label: "Intimidation", value: "intimidation" },
                      { label: "Investigation", value: "investigation" },
                    ],
                  },
                ]}
              />
              <Button
                variant="outlined"
                text="Get All Values"
                onPress={() => {
                  const values = dropdownGroupRef.current?.getValues();
                  setDropdownGroupValues(values || {});
                }}
              />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Switch</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <Switch
                heading="Dark Mode"
                checked={switchOn}
                onChange={setSwitchOn}
              />
              <Caption>Switch is: {switchOn ? "ON" : "OFF"}</Caption>
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Switch Group</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <SwitchGroup
                ref={switchGroupRef}
                title="Features"
                items={[
                  { key: "auto-save", heading: "Auto Save" },
                  { key: "notifications", heading: "Notifications" },
                ]}
              />
              <Button
                variant="outlined"
                text="Get All Values"
                onPress={() => {
                  const values = switchGroupRef.current?.getValues() || [];
                  const valuesObj = values.reduce(
                    (acc: any, key: string) => ({ ...acc, [key]: true }),
                    {},
                  );
                  setSwitchGroupValues(valuesObj);
                }}
              />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Switch Group (Exclusive)</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <SwitchGroup
                ref={switchGroupExclusiveRef}
                title="Difficulty"
                exclusive
                items={[
                  { key: "easy", heading: "Easy" },
                  { key: "normal", heading: "Normal" },
                  { key: "hard", heading: "Hard" },
                ]}
              />
              <Button
                variant="outlined"
                text="Get Selected"
                onPress={() => {
                  const values = switchGroupExclusiveRef.current?.getValues();
                  setSwitchGroupExclusiveValue(values?.[0] || "");
                }}
              />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Switch Group (Max 3)</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <SwitchGroup
                ref={switchGroupMaxRef}
                title="Spell Schools"
                maxActive={3}
                items={[
                  { key: "abjuration", heading: "Abjuration" },
                  { key: "conjuration", heading: "Conjuration" },
                  { key: "divination", heading: "Divination" },
                  { key: "enchantment", heading: "Enchantment" },
                  { key: "evocation", heading: "Evocation" },
                ]}
              />
              <Button
                variant="outlined"
                text="Get All Values"
                onPress={() => {
                  const values = switchGroupMaxRef.current?.getValues() || [];
                  const valuesObj = values.reduce(
                    (acc: any, key: string) => ({ ...acc, [key]: true }),
                    {},
                  );
                  setSwitchGroupMaxValues(valuesObj);
                }}
              />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Radio Button Group</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <RadioButtonGroup
                ref={radioGroupRef}
                title="Faction"
                direction="horizontal"
                items={[
                  { key: "order", label: "Order" },
                  { key: "chaos", label: "Chaos" },
                ]}
              />
              <Button
                variant="outlined"
                text="Get Selected"
                onPress={() => {
                  const value = radioGroupRef.current?.getValue();
                  setRadioGroupValue(value || "");
                }}
              />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Toggle Group</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <ToggleGroup
                ref={toggleGroupRef}
                title="Tools"
                items={[
                  { key: "map", icon: <Text>🗺️</Text> },
                  { key: "quill", icon: <Text>🪶</Text> },
                  { key: "potion", icon: <Text>🧪</Text> },
                ]}
              />
              <Button
                variant="outlined"
                text="Get All Values"
                onPress={() => {
                  const values = toggleGroupRef.current?.getValues();
                  setToggleGroupValues(values || {});
                }}
              />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Tabs</Heading>
            <View style={{ marginTop: S.space.md }}>
              <Tabs
                bottomSpace={tabValue !== "headings"}
                tabs={[
                  { key: "overview", label: "Overview" },
                  { key: "headings", label: "Headings" },
                  { key: "body", label: "Body" },
                  { key: "other", label: "Other" },
                ]}
                onChange={setTabValue}
              />
              {/* ⚠️ Content container below - marginTop creates spacing between tabs and content */}
              <View style={{ gap: S.space.sm, marginTop: S.space.md }}>
                {tabValue === "overview" && (
                  <>
                    <Body style={{ marginBottom: S.space.md }}>
                      This tab demonstrates all available font sizes and their
                      visual hierarchy. Each heading level and text style is
                      designed to work together for consistent typography.
                    </Body>
                  </>
                )}
                {tabValue === "headings" && (
                  <>
                    {/* Nested tabs with bottomSpace={false} to prevent weird spacing */}
                    <Tabs
                      bottomSpace={false}
                      tabs={[
                        { key: "textSecondary", label: "Secondary" },
                        { key: "textInverse", label: "Inverse" },
                        { key: "textOnAccent", label: "On Accent" },
                      ]}
                      onChange={setColorTabValue}
                    />
                    <View
                      style={{
                        padding: S.space.md,
                        borderRadius: S.radius.md,
                        backgroundColor:
                          colorTabValue === "textPrimary"
                            ? $("background")
                            : colorTabValue === "textSecondary"
                              ? $("surface")
                              : colorTabValue === "textInverse"
                                ? $("textPrimary")
                                : $("accent"),
                      }}
                    >
                      <Heading
                        fontSize="$heading1"
                        color={
                          colorTabValue === "textPrimary"
                            ? "$textPrimary"
                            : colorTabValue === "textSecondary"
                              ? "$textSecondary"
                              : colorTabValue === "textInverse"
                                ? "$textInverse"
                                : "$textOnAccent"
                        }
                      >
                        Heading 1
                      </Heading>
                      <Heading
                        fontSize="$heading2"
                        color={
                          colorTabValue === "textPrimary"
                            ? "$textPrimary"
                            : colorTabValue === "textSecondary"
                              ? "$textSecondary"
                              : colorTabValue === "textInverse"
                                ? "$textInverse"
                                : "$textOnAccent"
                        }
                      >
                        Heading 2
                      </Heading>
                      <Heading
                        fontSize="$heading3"
                        color={
                          colorTabValue === "textPrimary"
                            ? "$textPrimary"
                            : colorTabValue === "textSecondary"
                              ? "$textSecondary"
                              : colorTabValue === "textInverse"
                                ? "$textInverse"
                                : "$textOnAccent"
                        }
                      >
                        Heading 3
                      </Heading>
                      <ObjHeading
                        color={
                          colorTabValue === "textPrimary"
                            ? "$textPrimary"
                            : colorTabValue === "textSecondary"
                              ? "$textSecondary"
                              : colorTabValue === "textInverse"
                                ? "$textInverse"
                                : "$textOnAccent"
                        }
                      >
                        Object Heading
                      </ObjHeading>
                      <SubTitle
                        color={
                          colorTabValue === "textPrimary"
                            ? "$textPrimary"
                            : colorTabValue === "textSecondary"
                              ? "$textSecondary"
                              : colorTabValue === "textInverse"
                                ? "$textInverse"
                                : "$textOnAccent"
                        }
                      >
                        SubTitle
                      </SubTitle>
                    </View>
                  </>
                )}
                {tabValue === "body" && (
                  <>
                    <Body fontSize="$body1">
                      Body 1 text example for normal content.
                    </Body>
                    <Body fontSize="$body2">
                      Body 2 text example for normal content.
                    </Body>
                    <Body fontSize="$body3">
                      Body 3 text example for normal content.
                    </Body>
                    <Paragraph>
                      Paragraph component for longer text blocks with proper
                      line height and spacing.
                    </Paragraph>
                  </>
                )}
                {tabValue === "other" && (
                  <>
                    <Link>Link text for navigation</Link>
                    <Caption>Caption text for small notes</Caption>
                  </>
                )}
              </View>
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Accordion title="Accordion Component" defaultOpen>
              <Body>
                The accordion component allows you to collapse and expand
                content sections. This is particularly useful for organizing
                large amounts of information in a compact, user-friendly way.
                Click the header to toggle the visibility of this content. You
                can use accordions for FAQs, settings panels, or any
                hierarchical content structure where users might want to focus
                on specific sections at a time.
              </Body>
              <Caption style={{ marginTop: S.space.sm }}>
                Toggle the accordion header to test expand/collapse behavior and
                animations.
              </Caption>
            </Accordion>
          </Surface>

          <Surface style={{ marginTop: S.space.lg, marginBottom: S.space.lg }}>
            <Heading>Modals, Toasts & Snackbars</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <Button text="Open Modal" onPress={() => setModalVisible(true)} />
              <Button
                text="Open Custom Modal"
                onPress={() => setModal2Visible(true)}
              />
              <Button
                text="Show Toast Info"
                onPress={() => showToast('Info', 'Hello from Desktop! Info', 'info')}
              />
              <Button
                text="Show Toast Success"
                onPress={() => showToast('Saved', 'Your progress has been saved successfully.', 'success')}
              />
              <Button
                text="Show Toast Warning"
                onPress={() => showToast('Warning', 'Hello from Desktop! Warning', 'warning')}
              />
              <Button
                text="Show Toast Error"
                onPress={() => showToast('Error', 'Hello from Desktop! Error', 'error')}
              />
              <Button
                text="Show Snackbar"
                onPress={() => showSnackbar('Saved successfully', { tone: 'success' })}
              />
            </View>
          </Surface>
          
          <Surface style={{ marginTop: S.space.lg, marginBottom: S.space.xl }}>
            <Heading>Job Operations (Test Panel)</Heading>
            <Body style={{ marginBottom: S.space.md }}>
              Click buttons to add jobs to the JobOperationPanel (bottom-right corner). The panel expands upward from the bottom anchor.
            </Body>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <Button
                variant="primary"
                text="Add Successful Upload (will complete in 3-5s)"
                onPress={handleAddSuccessfulUpload}
              />
              <Button
                variant="destructive"
                text="Add Failing Download (will fail at 60%)"
                onPress={handleAddFailingDownload}
              />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg, marginBottom: S.space.lg }}>
            <Heading>Spinner (CustomLoad)</Heading>
            <View
              style={{
                flexDirection: "row",
                gap: S.space.md,
                marginTop: S.space.md,
              }}
            >
              <CustomLoad size="small" />
              <CustomLoad size="large" />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg, marginBottom: S.space.lg }}>
            <Heading>Loading Spinner</Heading>
            <View
              style={{
                flexDirection: "row",
                gap: S.space.md,
                marginTop: S.space.md,
                alignItems: "center",
              }}
            >
              <CustomLoad size="small" mode="spinner" />
              <CustomLoad size="medium" mode="spinner" />
              <CustomLoad size="large" mode="spinner" />
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg, marginBottom: S.space.xl }}>
            <Heading>Tooltips</Heading>
            <View
              style={{
                gap: S.space.md,
                marginTop: S.space.md,
                alignItems: "flex-start",
              }}
            >
              <AppTooltip text="This is a helpful tooltip!">
                <Button
                  variant="outlined"
                  text="Hover or Press Me"
                  onPress={() => {}}
                />
              </AppTooltip>

              <AppTooltip text="Tooltips work on any component" delay={300}>
                <Body>Hover over this text</Body>
              </AppTooltip>

              <AppTooltip text="Quick tooltip" delay={100}>
                <IconButton content="ℹ️" onPress={() => {}} />
              </AppTooltip>
            </View>
          </Surface>
        </ScrollView>
      }
      right={
        <ScrollView style={{ padding: S.space.md }}>
          <Surface>
            <Title>Component State Overview</Title>
            <Body>
              This panel displays the current state of all interactive
              components on the left.
            </Body>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Gradient Demo</Heading>
            <Heading>🌈 Gradient System Demo</Heading>
            <Body style={{ marginBottom: S.space.xl }}>
              Tight, dramatic gradients from light to dark
            </Body>

            {/* Cards with Gradients */}
            <Heading
              style={{ marginTop: S.space.xl, marginBottom: S.space.md }}
            >
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
            <Heading
              style={{ marginTop: S.space.xl, marginBottom: S.space.md }}
            >
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
            <Heading
              style={{ marginTop: S.space.xl, marginBottom: S.space.md }}
            >
              Side-by-Side Comparison
            </Heading>

            <View
              style={{
                flexDirection: "row",
                gap: S.space.md,
                marginBottom: S.space.xxl,
              }}
            >
              <Card style={{ flex: 1 }}>
                <SubTitle>No Gradient</SubTitle>
                <Body>Flat background</Body>
              </Card>

              <Card gradient style={{ flex: 1 }}>
                <SubTitle>With Gradient</SubTitle>
                <Body>Dramatic depth</Body>
              </Card>
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Button States</Heading>
            <View style={{ gap: S.space.xs, marginTop: S.space.md }}>
              <Body>Primary button clicks: {primaryClicks}</Body>
              <Body>Last icon clicked: {iconButtonClicks || "None"}</Body>
              <Body>Button group: {buttonGroupValue || "None"}</Body>
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Input States</Heading>
            <View style={{ gap: S.space.xs, marginTop: S.space.md }}>
              <Body>TextInput: {textInputValue || "(empty)"}</Body>
              <Body>DescInput: {descInputValue || "(empty)"}</Body>
              {Object.keys(textInputGroupValues).length > 0 && (
                <>
                  <SubTitle style={{ marginTop: S.space.sm }}>
                    Input Group:
                  </SubTitle>
                  {Object.entries(textInputGroupValues).map(([key, value]) => (
                    <Body key={key}>
                      {key}: {(value as string) || "(empty)"}
                    </Body>
                  ))}
                </>
              )}
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Selection States</Heading>
            <View style={{ gap: S.space.xs, marginTop: S.space.md }}>
              <Body>Dropdown: {dropdownValue || "None"}</Body>
              {Object.keys(dropdownGroupValues).length > 0 && (
                <>
                  <SubTitle style={{ marginTop: S.space.sm }}>
                    Dropdown Group:
                  </SubTitle>
                  {Object.entries(dropdownGroupValues).map(([key, value]) => (
                    <Body key={key}>
                      {key}: {(value as string) || "None"}
                    </Body>
                  ))}
                </>
              )}
              <Body style={{ marginTop: S.space.sm }}>
                Active Tab: {tabValue}
              </Body>
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg }}>
            <Heading>Radio & Toggle States</Heading>
            <View style={{ gap: S.space.xs, marginTop: S.space.md }}>
              <Body>Radio Group: {radioGroupValue || "None"}</Body>
              {Object.keys(toggleGroupValues).length > 0 && (
                <>
                  <SubTitle style={{ marginTop: S.space.sm }}>
                    Toggle Group:
                  </SubTitle>
                  {Object.entries(toggleGroupValues).map(([key, value]) => (
                    <Body key={key}>
                      {key}: {value ? "ON" : "OFF"}
                    </Body>
                  ))}
                </>
              )}
            </View>
          </Surface>

          <Surface style={{ marginTop: S.space.lg, marginBottom: S.space.xl }}>
            <Heading>Test All Components</Heading>
            <View style={{ gap: S.space.md, marginTop: S.space.md }}>
              <Button
                variant="outlined"
                text="Refresh All Values"
                onPress={() => {
                  setButtonGroupValue(buttonGroupRef.current?.getValue() || "");
                  setTextInputGroupValues(
                    textInputGroupRef.current?.getValues() || {},
                  );
                  setDropdownGroupValues(
                    dropdownGroupRef.current?.getValues() || {},
                  );

                  const switchVals = switchGroupRef.current?.getValues() || [];
                  setSwitchGroupValues(
                    switchVals.reduce(
                      (acc: any, key: string) => ({ ...acc, [key]: true }),
                      {},
                    ),
                  );

                  const exclusiveVals =
                    switchGroupExclusiveRef.current?.getValues() || [];
                  setSwitchGroupExclusiveValue(exclusiveVals[0] || "");

                  const maxVals = switchGroupMaxRef.current?.getValues() || [];
                  setSwitchGroupMaxValues(
                    maxVals.reduce(
                      (acc: any, key: string) => ({ ...acc, [key]: true }),
                      {},
                    ),
                  );

                  setRadioGroupValue(radioGroupRef.current?.getValue() || "");

                  const toggleVals = toggleGroupRef.current?.getValues() || [];
                  setToggleGroupValues(
                    toggleVals.reduce(
                      (acc: any, key: string) => ({ ...acc, [key]: true }),
                      {},
                    ),
                  );
                }}
              />
            </View>
          </Surface>
        </ScrollView>
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
          <Body>
            This modal demonstrates using custom children alongside the heading
            prop
          </Body>
          <Button text="Close" onPress={() => setModal2Visible(false)} />
        </View>
      </AppModal>
    </AppSplit>
  );
}
