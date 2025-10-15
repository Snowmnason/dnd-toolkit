import { CoreColors } from '@/constants/corecolors';
import { BorderRadius, Spacing } from '@/constants/theme';
import React, { useState } from 'react';
import { TextStyle, ViewStyle } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';

interface DropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: string[];
  style?: ViewStyle;
  placeholder?: string;
}

interface DropdownItem {
  label: string;
  value: string;
}

export default function Dropdown({ 
  value, 
  onChange, 
  options, 
  style = {}, 
  placeholder = "Select an option..." 
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [dropdownValue, setDropdownValue] = useState<string | null>(value);
  const [items, setItems] = useState<DropdownItem[]>(
    options.map(option => ({
      label: option,
      value: option,
    }))
  );

  const handleValueChange = (val: string | null) => {
    setDropdownValue(val);
    if (onChange) {
      onChange(val);
    }
  };

  return (
    <DropDownPicker
      open={open}
      value={dropdownValue}
      items={items}
      setOpen={setOpen}
      setValue={setDropdownValue}
      setItems={setItems}
      onChangeValue={handleValueChange}
      placeholder={placeholder}
      style={{
        borderColor: CoreColors.secondary,
        backgroundColor: CoreColors.backgroundLight,
        borderRadius: BorderRadius.sm,
        marginBottom: Spacing.md,
        ...style,
      } as ViewStyle}
      textStyle={{
        color: CoreColors.textOnLight,
        fontSize: 16,
      } as TextStyle}
      placeholderStyle={{
        color: CoreColors.textSecondary,
        fontSize: 16,
        opacity: 0.7,
      } as TextStyle}
      dropDownContainerStyle={{
        borderColor: CoreColors.secondary,
        backgroundColor: CoreColors.backgroundLight,
        borderRadius: BorderRadius.sm,
      } as ViewStyle}
      listItemLabelStyle={{
        color: CoreColors.textOnLight,
        fontSize: 16,
      } as TextStyle}
      selectedItemLabelStyle={{
        color: CoreColors.textOnLight,
        fontWeight: 'bold',
      } as TextStyle}
      arrowIconStyle={{
        tintColor: CoreColors.textOnLight,
      } as any}
      tickIconStyle={{
        tintColor: CoreColors.textOnLight,
      } as any}
      zIndex={1000}
      zIndexInverse={3000}
    />
  );
}