import { Picker } from '@react-native-picker/picker';
import { Platform } from 'react-native';

const styles = {
  dropField: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#333',
    color: 'white',
    marginBottom: 16,
  },
};

export default function Dropdown({ value, onChange, options, style }) {
  if (Platform.OS === 'web') {
    return (
      <select
         style={{ ...styles.dropField, ...style }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  // Mobile picker
  return (
    <Picker
      selectedValue={value}
      onValueChange={onChange}
       style={{ ...styles.dropField, ...style }}
    >
      {options.map(opt => (
        <Picker.Item key={opt} label={opt} value={opt} />
      ))}
    </Picker>
  );
}