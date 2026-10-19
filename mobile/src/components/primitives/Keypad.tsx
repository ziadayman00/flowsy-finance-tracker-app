import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from './Icon';
import { toArabicDigits } from '../../utils/format';

interface KeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxDecimals?: number;
  maxIntegerDigits?: number;
}

export const Keypad: React.FC<KeypadProps> = ({
  value,
  onChange,
  maxDecimals = 2,
  maxIntegerDigits = 12,
}) => {
  const { colors, radii } = useTheme();

  const handleDigit = (digit: string) => {
    // Leading zero collapse
    if (value === '0' || value === '') {
      if (digit === '.') {
        onChange('0.');
        return;
      }
      onChange(digit);
      return;
    }

    if (digit === '.') {
      if (value.includes('.')) return; // Only one decimal point allowed
      onChange(`${value}.`);
      return;
    }

    // Check decimal places constraint
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts[1] && parts[1].length >= maxDecimals) {
        return; // Exceeded max decimal places
      }
    } else {
      // Check integer digits constraint
      if (value.length >= maxIntegerDigits) {
        return;
      }
    }

    onChange(`${value}${digit}`);
  };

  const handleBackspace = () => {
    if (value.length <= 1) {
      onChange('');
    } else {
      onChange(value.slice(0, -1));
    }
  };

  const handleLongPressBackspace = () => {
    onChange('');
  };

  const keys: Array<string | 'backspace'> = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '.', '0', 'backspace',
  ];

  return (
    <View style={styles.grid}>
      {keys.map((key, idx) => {
        if (key === 'backspace') {
          return (
            <Pressable
              key={`key-${idx}`}
              onPress={handleBackspace}
              onLongPress={handleLongPressBackspace}
              style={({ pressed }) => [
                styles.key,
                {
                  borderRadius: radii.sm,
                  backgroundColor: pressed ? colors.sunken : 'transparent',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="حذف رقم"
            >
              <Icon name="backspace-outline" size={24} color={colors.textPrimary} />
            </Pressable>
          );
        }

        return (
          <Pressable
            key={`key-${idx}`}
            onPress={() => handleDigit(key)}
            style={({ pressed }) => [
              styles.key,
              {
                borderRadius: radii.sm,
                backgroundColor: pressed ? colors.sunken : 'transparent',
              },
            ]}
            accessibilityRole="button"
              accessibilityLabel={key === '.' ? 'فاصلة عشرية' : toArabicDigits(key)}
          >
            <Text
              style={[
                styles.keyText,
                {
                  color: colors.textPrimary,
                  fontVariant: ['tabular-nums'],
                },
              ]}
            >
              {key === '.' ? '٫' : toArabicDigits(key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    paddingVertical: 4,
  },
  key: {
    width: '33.33%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '500',
  },
});
