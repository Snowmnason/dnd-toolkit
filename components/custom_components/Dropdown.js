import { BorderRadius, CoreColors, Spacing, Typography } from '@/constants/theme';
import { useState } from 'react';
import DropDownPicker from 'react-native-dropdown-picker';

export default function Dropdown({ value, onChange, options, style = {}, placeholder = "Select an option..." }) {
  const [open, setOpen] = useState(false);
  const [dropdownValue, setDropdownValue] = useState(value);

  // Convert options array to the format expected by react-native-dropdown-picker
  //https://hossein-zare.github.io/react-native-dropdown-picker-website/docs/changelog
  const items = options.map(option => ({
    label: option,
    value: option,
  }));

  const handleValueChange = (val) => {
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
      setValue={handleValueChange}
      placeholder={placeholder}
      style={{
        borderColor: CoreColors.secondary,
        backgroundColor: CoreColors.backgroundLight,
        borderRadius: BorderRadius.sm,
        marginBottom: Spacing.md,
        ...style,
      }}
      textStyle={{
        color: CoreColors.textOnLight,
        fontFamily: Typography.fontFamilyPrimary,
        fontSize: 16,
      }}
      placeholderStyle={{
        color: CoreColors.textSecondary,
        fontFamily: Typography.fontFamilyPrimary,
        fontSize: 16,
        opacity: 0.7,
      }}
      dropDownContainerStyle={{
        borderColor: CoreColors.secondary,
        backgroundColor: CoreColors.backgroundLight,
        borderRadius: BorderRadius.sm,
      }}
      listItemLabelStyle={{
        color: CoreColors.textOnLight,
        fontFamily: Typography.fontFamilyPrimary,
        fontSize: 16,
      }}
      selectedItemLabelStyle={{
        color: CoreColors.textOnLight,
        fontWeight: 'bold',
      }}
      arrowIconStyle={{
        tintColor: CoreColors.textOnLight,
      }}
      tickIconStyle={{
        tintColor: CoreColors.textOnLight,
      }}
      zIndex={1000}
      zIndexInverse={3000}
    />
  );
}