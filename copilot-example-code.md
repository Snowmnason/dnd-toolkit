Dialog box --has a select menu which is not needed
import { ChevronDown, X } from '@tamagui/lucide-icons'
import {
  Adapt,
  Button,
  Dialog,
  Fieldset,
  Input,
  Label,
  Paragraph,
  Select,
  Sheet,
  TooltipSimple,
  Unspaced,
  View,
  XStack,
} from 'tamagui'
import { SelectDemoContents } from './SelectDemo'

export function DialogDemo() {
  return (
    <View gap="$4" justifyContent="center" alignItems="center">
      <DialogInstance />
      <DialogInstance disableAdapt />
    </View>
  )
}

function DialogInstance({ disableAdapt }: { disableAdapt?: boolean }) {
  return (
    <Dialog modal>
      <Dialog.Trigger asChild>
        <Button>
          <Button.Text>Show Dialog{disableAdapt ? ` (No Sheet)` : ''}</Button.Text>
        </Button>
      </Dialog.Trigger>

      {!disableAdapt && (
        <Adapt when="maxMd" platform="touch">
          <Sheet
            animation="medium"
            zIndex={200000}
            modal
            dismissOnSnapToBottom
            unmountChildrenWhenHidden // we're nesting infinitely so need this
          >
            <Sheet.Frame padding="$4" gap="$4">
              <Adapt.Contents />
            </Sheet.Frame>
            <Sheet.Overlay
              backgroundColor="$shadow6"
              animation="lazy"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
            />
          </Sheet>
        </Adapt>
      )}

      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          backgroundColor="$shadow6"
          animateOnly={['transform', 'opacity']}
          animation={[
            'quicker',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />

        <Dialog.FocusScope focusOnIdle>
          <Dialog.Content
            bordered
            paddingVertical="$4"
            paddingHorizontal="$6"
            elevate
            borderRadius="$6"
            key="content"
            animateOnly={['transform', 'opacity']}
            animation={[
              'quicker',
              {
                opacity: {
                  overshootClamping: true,
                },
              },
            ]}
            enterStyle={{ x: 0, y: 20, opacity: 0 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            gap="$4"
          >
            <Dialog.Title>Edit profile</Dialog.Title>
            <Dialog.Description>
              Make changes to your profile here. Click save when you're done.
            </Dialog.Description>

            <Fieldset gap="$4" horizontal>
              <Label width={64} htmlFor="name">
                Name
              </Label>
              <Input flex={1} id="name" defaultValue="Nate Wienert" />
            </Fieldset>

            <Fieldset gap="$4" horizontal>
              <Label width={64} htmlFor="username">
                <TooltipSimple label="Pick your favorite" placement="bottom-start">
                  <Paragraph>Food</Paragraph>
                </TooltipSimple>
              </Label>
              <XStack flex={1}>
                <SelectDemoContents
                  trigger={
                    <Select.Trigger flex={1} iconAfter={ChevronDown}>
                      <Select.Value placeholder="Something" />
                    </Select.Trigger>
                  }
                />
              </XStack>
            </Fieldset>

            <XStack alignSelf="flex-end" gap="$4">
              <DialogInstance />

              <Dialog.Close displayWhenAdapted asChild>
                <Button theme="accent" aria-label="Close">
                  Save changes
                </Button>
              </Dialog.Close>
            </XStack>

            <Unspaced>
              <Dialog.Close asChild>
                <Button position="absolute" right="$3" size="$2" circular icon={X} />
              </Dialog.Close>
            </Unspaced>
          </Dialog.Content>
        </Dialog.FocusScope>
      </Dialog.Portal>
    </Dialog>
  )
}

AlertDialog --has two buttons, only one is needed
import { AlertDialog, Button, XStack, YStack } from 'tamagui'

export function AlertDialogDemo() {
  return (
    <AlertDialog native>
      <AlertDialog.Trigger asChild>
        <Button>Show Alert</Button>
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Overlay
          key="overlay"
          animation="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <AlertDialog.Content
          bordered
          elevate
          key="content"
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          x={0}
          scale={1}
          opacity={1}
          y={0}
        >
          <YStack gap="$4">
            <AlertDialog.Title>Accept</AlertDialog.Title>
            <AlertDialog.Description>
              By pressing yes, you accept our terms and conditions.
            </AlertDialog.Description>

            <XStack gap="$3" justifyContent="flex-end">
              <AlertDialog.Cancel asChild>
                <Button>Cancel</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button theme="accent">Accept</Button>
              </AlertDialog.Action>
            </XStack>
          </YStack>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog>
  )
}


import { Toast, useToastController, useToastState } from '@tamagui/toast'
import React from 'react'
import { Button, isWeb, Label, Switch, XStack, YStack } from 'tamagui'

/**
 *  IMPORTANT NOTE: if you're copy-pasting this demo into your code, make sure to add:
 *    - <ToastProvider> at the root
 *    - <ToastViewport /> where you want to show the toasts
 */
export const ToastDemo = () => {
  const [native, setNative] = React.useState(false)

  return (
    <YStack space alignItems="center">
      <ToastControl native={native} />
      <CurrentToast />

      <NativeOptions native={native} setNative={setNative} />
    </YStack>
  )
}

const CurrentToast = () => {
  const currentToast = useToastState()

  if (!currentToast || currentToast.isHandledNatively) return null

  return (
    <Toast
      animation="200ms"
      key={currentToast.id}
      duration={currentToast.duration}
      enterStyle={{ opacity: 0, transform: [{ translateY: 100 }] }}
      exitStyle={{ opacity: 0, transform: [{ translateY: 100 }] }}
      transform={[{ translateY: 0 }]}
      opacity={1}
      scale={1}
      viewportName={currentToast.viewportName}
    >
      <YStack>
        <Toast.Title>{currentToast.title}</Toast.Title>
        {!!currentToast.message && (
          <Toast.Description>{currentToast.message}</Toast.Description>
        )}
      </YStack>
    </Toast>
  )
}

const ToastControl = ({ native }: { native: boolean }) => {
  const toast = useToastController()

  return (
    <XStack gap="$2" justifyContent="center">
      <Button
        onPress={() => {
          toast.show('Successfully saved!', {
            message: "Don't worry, we've got your data.",
            native,
            demo: true,
          })
        }}
      >
        Show
      </Button>
      <Button
        onPress={() => {
          toast.hide()
        }}
      >
        Hide
      </Button>
    </XStack>
  )
}

totast
const NativeOptions = ({
  native,
  setNative,
}: {
  native: boolean
  setNative: (native: boolean) => void
}) => {
  return (
    <XStack gap="$3">
      <Label size="$1" onPress={() => setNative(false)}>
        Custom
      </Label>
      <Switch
        id="native-toggle"
        nativeID="native-toggle"
        theme="accent"
        size="$1"
        checked={!!native}
        onCheckedChange={(val) => setNative(val)}
      >
        <Switch.Thumb
          animation={[
            'quick',
            {
              transform: {
                overshootClamping: true,
              },
            },
          ]}
        />
      </Switch>

      <Label size="$1" onPress={() => setNative(true)}>
        Native
      </Label>
    </XStack>
  )
}