import { useThemeColor } from '@/hooks/use-theme-color';
import { useState } from 'react';
import DropDownPicker from 'react-native-dropdown-picker';

export default function Dropdown({ value, onChange, options, style = {}, placeholder = "Select an option..." }) {
  const [open, setOpen] = useState(false);
  const [dropdownValue, setDropdownValue] = useState(value);
  const bgColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'icon');
  const textColor = useThemeColor({}, 'text');

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
        borderColor,
        backgroundColor: bgColor,
        borderRadius: 8,
        marginBottom: 16,
        ...style,
      }}
      textStyle={{
        color: textColor,
        fontFamily: 'GrenzeGotisch',
        fontSize: 16,
      }}
      placeholderStyle={{
        color: textColor,
        fontFamily: 'GrenzeGotisch',
        fontSize: 16,
        opacity: 0.7,
      }}
      dropDownContainerStyle={{
        borderColor,
        backgroundColor: bgColor,
        borderRadius: 8,
      }}
      listItemLabelStyle={{
        color: textColor,
        fontFamily: 'GrenzeGotisch',
        fontSize: 16,
      }}
      selectedItemLabelStyle={{
        color: textColor,
        fontWeight: 'bold',
      }}
      arrowIconStyle={{
        tintColor: textColor,
      }}
      tickIconStyle={{
        tintColor: textColor,
      }}
      zIndex={1000}
      zIndexInverse={3000}
    />
  );
}