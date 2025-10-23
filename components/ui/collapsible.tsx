import { PropsWithChildren, useState } from 'react';
import { TouchableOpacity } from 'react-native';

import { IconSymbol } from '@/components/built-in/icon-symbol';
import { Body } from '@/components/ui';
import { ThemedView } from '@/components/ui/themed-view';
import { CoreColors } from '@/constants/corecolors';
import { Spacing } from '@/constants/theme';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ThemedView>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs
        }}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}>
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={CoreColors.textSecondary}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />

        <Body variant='semi'>{title}</Body>
      </TouchableOpacity>
      {isOpen && (
        <ThemedView style={{
          marginTop: Spacing.xs,
          marginLeft: Spacing.lg
        }}>
          {children}
        </ThemedView>
      )}
    </ThemedView>
  );
}
