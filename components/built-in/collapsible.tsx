import { IconSymbol } from '@/components/built-in/icon-symbol';
import { Body } from '@/components/ui';
import { $, S } from '@/theme';
import { PropsWithChildren, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: S.space.xs
        }}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}>
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={$('textSecondary')}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />

        <Body variant='semi'>{title}</Body>
      </TouchableOpacity>
      {isOpen && (
        <View style={{
          marginTop: S.space.xs,
          marginLeft: S.space.lg
        }}>
          {children}
        </View>
      )}
    </View>
  );
}
